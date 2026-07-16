from __future__ import annotations

import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from .analyzer import MAX_AUDIO_SECONDS, MusicAnalyzer, SCHEMA_VERSION


MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_REMOTE_BYTES = 20 * 1024 * 1024
ALLOWED_SOURCE_KINDS = {"upload", "preset", "search"}
ALLOWED_REMOTE_HOST_SUFFIXES = (".jamendo.com",)
REMOTE_DOWNLOAD_TIMEOUT_SECONDS = 60
MAX_REMOTE_REDIRECTS = 4

analyzer = MusicAnalyzer()
semantic_preload_error: str | None = None


def _preload_enabled() -> bool:
    return os.environ.get("CLAP_PRELOAD", "1").lower() not in {"0", "false", "no"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    global semantic_preload_error
    semantic_preload_error = None
    if _preload_enabled() and analyzer.semantic_analyzer.enabled:
        try:
            await run_in_threadpool(analyzer.semantic_analyzer.warmup)
        except Exception as error:
            semantic_preload_error = str(error)
    yield


app = FastAPI(
    title="MelodyVision Audio Analysis",
    version="0.2.0",
    description="Version 2 music analysis service for the MelodyVision application.",
    lifespan=lifespan,
)


def _allowed_origins() -> list[str]:
    configured = os.environ.get(
        "AUDIO_ANALYSIS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_origin_regex=os.environ.get("AUDIO_ANALYSIS_ALLOWED_ORIGIN_REGEX") or None,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class RemoteAnalyzeRequest(BaseModel):
    sourceUrl: str
    fileName: str = "jamendo-track.mp3"
    mimeType: str = "audio/mpeg"
    sessionId: str = "prototype"
    sourceKind: str = "search"
    catalogItemId: str | None = None


def _is_allowed_remote_url(value: str) -> bool:
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    return (
        parsed.scheme == "https"
        and parsed.username is None
        and parsed.password is None
        and any(host == suffix[1:] or host.endswith(suffix) for suffix in ALLOWED_REMOTE_HOST_SUFFIXES)
    )


def _download_remote_audio(source_url: str, suffix: str) -> tuple[Path, int, str]:
    current_url = source_url
    temporary_path: Path | None = None
    total_bytes = 0
    content_type = "audio/mpeg"

    try:
        with httpx.Client(timeout=REMOTE_DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=False) as client:
            for _ in range(MAX_REMOTE_REDIRECTS + 1):
                if not _is_allowed_remote_url(current_url):
                    raise ValueError("Remote audio URL is not an allowed Jamendo HTTPS URL")
                with client.stream("GET", current_url, headers={"Accept": "audio/mpeg,audio/*"}) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise ValueError("Remote audio redirect is missing a location")
                        current_url = urljoin(current_url, location)
                        continue
                    response.raise_for_status()
                    declared_size = int(response.headers.get("content-length") or 0)
                    if declared_size > MAX_REMOTE_BYTES:
                        raise ValueError("Remote audio exceeds the 20 MB limit")
                    content_type = response.headers.get("content-type") or content_type
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary_file:
                        temporary_path = Path(temporary_file.name)
                        for chunk in response.iter_bytes(1024 * 1024):
                            total_bytes += len(chunk)
                            if total_bytes > MAX_REMOTE_BYTES:
                                raise ValueError("Remote audio exceeds the 20 MB limit")
                            temporary_file.write(chunk)
                    if total_bytes < 1024:
                        raise ValueError("Remote audio is empty or invalid")
                    return temporary_path, total_bytes, content_type
            raise ValueError("Remote audio exceeded the redirect limit")
    except Exception:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "schemaVersion": SCHEMA_VERSION,
        "maxAudioSeconds": MAX_AUDIO_SECONDS,
        "semanticModel": analyzer.semantic_analyzer.model_name,
        "semanticModelLoaded": analyzer.semantic_analyzer.loaded,
        "semanticDevice": analyzer.semantic_analyzer.device,
        "semanticPreloadEnabled": _preload_enabled(),
        "semanticPreloadError": semantic_preload_error,
        "rawAudioRetention": "temporary-file-deleted-after-request",
    }


@app.post("/analyze")
async def analyze_audio(
    file: UploadFile = File(...),
    sessionId: str = Form("prototype"),
    sourceKind: str = Form("upload"),
    catalogItemId: str | None = Form(None),
) -> dict[str, object]:
    if sourceKind not in ALLOWED_SOURCE_KINDS:
        raise HTTPException(status_code=422, detail="sourceKind must be upload, preset, or search")

    suffix = Path(file.filename or "audio.bin").suffix
    temporary_path: Path | None = None
    total_bytes = 0

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary_file:
            temporary_path = Path(temporary_file.name)
            while chunk := await file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Audio file exceeds the 50 MB prototype limit")
                temporary_file.write(chunk)

        return await run_in_threadpool(
            analyzer.analyze_file,
            temporary_path,
            session_id=sessionId,
            source_kind=sourceKind,
            original_name=file.filename,
            mime_type=file.content_type,
            catalog_item_id=catalogItemId,
        )
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {error}") from error
    finally:
        await file.close()
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


@app.post("/analyze-remote")
async def analyze_remote_audio(request: RemoteAnalyzeRequest) -> dict[str, object]:
    if request.sourceKind != "search":
        raise HTTPException(status_code=422, detail="Remote analysis only supports search sources")
    if not _is_allowed_remote_url(request.sourceUrl):
        raise HTTPException(status_code=422, detail="Remote audio URL is not allowed")

    suffix = Path(request.fileName).suffix or ".mp3"
    temporary_path: Path | None = None
    try:
        temporary_path, _, content_type = await run_in_threadpool(
            _download_remote_audio,
            request.sourceUrl,
            suffix,
        )
        return await run_in_threadpool(
            analyzer.analyze_file,
            temporary_path,
            session_id=request.sessionId,
            source_kind=request.sourceKind,
            original_name=request.fileName,
            mime_type=request.mimeType or content_type,
            catalog_item_id=request.catalogItemId,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Remote audio download failed: {error}") from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Remote audio analysis failed: {error}") from error
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.environ.get("AUDIO_ANALYSIS_HOST", "127.0.0.1"),
        port=int(os.environ.get("AUDIO_ANALYSIS_PORT", "8001")),
    )
