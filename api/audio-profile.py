from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urljoin, urlparse

import httpx


ROOT = Path(__file__).resolve().parents[1]
SERVICE_ROOT = ROOT / "services" / "audio-analysis"
sys.path.insert(0, str(SERVICE_ROOT))

os.environ.setdefault("CLAP_DISABLED", "1")
os.environ.setdefault("CLAP_PRELOAD", "0")
os.environ.setdefault("NUMBA_CACHE_DIR", "/tmp/melodyvision-numba")

from app.analyzer import MAX_AUDIO_SECONDS, MusicAnalyzer, SCHEMA_VERSION  # noqa: E402


MAX_AUDIO_BYTES = 20 * 1024 * 1024
MAX_REQUEST_BYTES = 64 * 1024
ALLOWED_SOURCE_KINDS = {"upload", "preset", "search"}
ALLOWED_REMOTE_HOST = re.compile(r"^prod-\d+\.storage\.jamendo\.com$", re.IGNORECASE)
MANAGED_AUDIO_PATH = re.compile(
    r"^incoming/\d{4}-\d{2}-\d{2}/"
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    r"\.(mp3|wav|flac|ogg)$"
)
ALLOWED_SUFFIXES = {".mp3", ".wav", ".flac", ".ogg"}
analyzer = MusicAnalyzer()


class RequestError(RuntimeError):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RequestError(503, f"{name} is not configured")
    return value


def _safe_text(value: Any, default: str, max_length: int = 240) -> str:
    if not isinstance(value, str):
        return default
    normalized = value.strip()
    return normalized[:max_length] or default


def _safe_suffix(file_name: str) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise RequestError(400, "Unsupported audio file extension")
    return suffix


def _warm_requested(path: str) -> bool:
    return parse_qs(urlparse(path).query).get("warm") == ["1"]


def _allowed_remote_url(value: str) -> bool:
    parsed = urlparse(value)
    return (
        parsed.scheme == "https"
        and parsed.username is None
        and parsed.password is None
        and bool(ALLOWED_REMOTE_HOST.fullmatch(parsed.hostname or ""))
    )


def _write_stream(response: httpx.Response, suffix: str) -> Path:
    declared_size = int(response.headers.get("content-length") or 0)
    if declared_size > MAX_AUDIO_BYTES:
        raise RequestError(413, "Audio file exceeds the 20 MB limit")

    total_bytes = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary_file:
        temporary_path = Path(temporary_file.name)
        try:
            for chunk in response.iter_bytes(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > MAX_AUDIO_BYTES:
                    raise RequestError(413, "Audio file exceeds the 20 MB limit")
                temporary_file.write(chunk)
        except Exception:
            temporary_path.unlink(missing_ok=True)
            raise

    if total_bytes < 1024:
        temporary_path.unlink(missing_ok=True)
        raise RequestError(422, "Audio file is empty or invalid")
    return temporary_path


def _download_storage_audio(storage_path: str, suffix: str) -> Path:
    if not MANAGED_AUDIO_PATH.fullmatch(storage_path):
        raise RequestError(400, "Invalid managed audio storage path")

    base_url = _required_env("SUPABASE_URL").rstrip("/")
    service_key = _required_env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = os.environ.get("SUPABASE_AUDIO_BUCKET", "audio-analysis").strip()
    object_url = (
        f"{base_url}/storage/v1/object/{quote(bucket, safe='')}/"
        f"{quote(storage_path, safe='/')}"
    )
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "audio/*,application/octet-stream",
    }
    with httpx.Client(timeout=60.0) as client:
        with client.stream("GET", object_url, headers=headers) as response:
            if response.status_code == 404:
                raise RequestError(404, "Uploaded audio was not found")
            response.raise_for_status()
            return _write_stream(response, suffix)


def _download_remote_audio(source_url: str, suffix: str) -> Path:
    current_url = source_url
    with httpx.Client(timeout=60.0, follow_redirects=False) as client:
        for _ in range(5):
            if not _allowed_remote_url(current_url):
                raise RequestError(400, "Remote audio URL is not an allowed Jamendo URL")
            with client.stream(
                "GET",
                current_url,
                headers={"Accept": "audio/mpeg,audio/*"},
            ) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise RequestError(502, "Remote audio redirect is invalid")
                    current_url = urljoin(current_url, location)
                    continue
                response.raise_for_status()
                return _write_stream(response, suffix)
    raise RequestError(502, "Remote audio exceeded the redirect limit")


def _delete_storage_audio(storage_path: str) -> None:
    if not MANAGED_AUDIO_PATH.fullmatch(storage_path):
        return
    base_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    bucket = os.environ.get("SUPABASE_AUDIO_BUCKET", "audio-analysis").strip()
    if not base_url or not service_key:
        return
    try:
        httpx.request(
            "DELETE",
            f"{base_url}/storage/v1/object/{quote(bucket, safe='')}",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            json={"prefixes": [storage_path]},
            timeout=15.0,
        )
    except httpx.HTTPError:
        pass


def analyze_request(payload: dict[str, Any]) -> dict[str, object]:
    session_id = _safe_text(payload.get("sessionId"), "anonymous", 160)
    source_kind = _safe_text(payload.get("sourceKind"), "upload", 24)
    if source_kind not in ALLOWED_SOURCE_KINDS:
        raise RequestError(400, "Invalid audio source kind")

    file_name = _safe_text(payload.get("fileName"), "audio.mp3")
    mime_type = _safe_text(payload.get("mimeType"), "application/octet-stream", 120)
    catalog_item_id = payload.get("catalogItemId")
    if catalog_item_id is not None:
        catalog_item_id = _safe_text(catalog_item_id, "", 160) or None
    suffix = _safe_suffix(file_name)

    storage_path = payload.get("storagePath")
    source_url = payload.get("sourceUrl")
    temporary_path: Path | None = None
    try:
        if isinstance(storage_path, str) and storage_path:
            temporary_path = _download_storage_audio(storage_path, suffix)
        elif isinstance(source_url, str) and source_url:
            if source_kind != "search":
                raise RequestError(400, "Remote analysis only supports search sources")
            temporary_path = _download_remote_audio(source_url, suffix)
        else:
            raise RequestError(400, "storagePath or sourceUrl is required")

        return analyzer.analyze_file(
            temporary_path,
            session_id=session_id,
            source_kind=source_kind,
            original_name=file_name,
            mime_type=mime_type,
            catalog_item_id=catalog_item_id,
        )
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        if isinstance(storage_path, str):
            _delete_storage_audio(storage_path)


class handler(BaseHTTPRequestHandler):
    def _json_response(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        warm_requested = _warm_requested(self.path)
        try:
            if warm_requested:
                analyzer.warmup()
            self._json_response(
                200,
                {
                    "status": "ok",
                    "provider": "vercel-python",
                    "schemaVersion": SCHEMA_VERSION,
                    "maxAudioSeconds": MAX_AUDIO_SECONDS,
                    "maxAudioBytes": MAX_AUDIO_BYTES,
                    "semanticAnalysis": "disabled",
                    "signalAnalyzerWarmed": analyzer.signal_warmed,
                    "rawAudioRetention": "temporary-object-deleted-after-request",
                },
            )
        except Exception as error:
            self._json_response(503, {"error": f"Audio analyzer warmup failed: {error}"})

    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("content-length") or 0)
            if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
                raise RequestError(413, "Invalid analysis request size")
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise RequestError(400, "Analysis request must be a JSON object")
            self._json_response(200, analyze_request(payload))
        except RequestError as error:
            self._json_response(error.status, {"error": str(error)})
        except json.JSONDecodeError:
            self._json_response(400, {"error": "Invalid JSON request"})
        except httpx.HTTPError as error:
            self._json_response(502, {"error": f"Audio download failed: {error}"})
        except ValueError as error:
            self._json_response(422, {"error": str(error)})
        except Exception as error:
            self._json_response(500, {"error": f"Audio analysis failed: {error}"})
