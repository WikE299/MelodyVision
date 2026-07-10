from __future__ import annotations

import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from .analyzer import MAX_AUDIO_SECONDS, MusicAnalyzer, SCHEMA_VERSION


MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_SOURCE_KINDS = {"upload", "preset", "search"}

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.environ.get("AUDIO_ANALYSIS_HOST", "127.0.0.1"),
        port=int(os.environ.get("AUDIO_ANALYSIS_PORT", "8001")),
    )
