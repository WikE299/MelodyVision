from __future__ import annotations

import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]
ENTRYPOINT = ROOT / "api" / "audio-profile.py"
SPEC = importlib.util.spec_from_file_location("melodyvision_vercel_audio", ENTRYPOINT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class VercelAudioEntrypointTests(unittest.TestCase):
    def test_remote_source_allowlist_is_exact(self) -> None:
        self.assertTrue(
            MODULE._allowed_remote_url(
                "https://prod-1.storage.jamendo.com/?trackid=123&format=mp31"
            )
        )
        self.assertFalse(
            MODULE._allowed_remote_url(
                "https://prod-1.storage.jamendo.com.example.org/audio.mp3"
            )
        )
        self.assertFalse(MODULE._allowed_remote_url("http://prod-1.storage.jamendo.com/a.mp3"))

    def test_storage_path_must_be_server_generated(self) -> None:
        valid = (
            "incoming/2026-07-17/"
            "7ca268a0-4704-4cb0-85c2-2715bc4be149.flac"
        )
        self.assertIsNotNone(MODULE.MANAGED_AUDIO_PATH.fullmatch(valid))
        self.assertIsNone(
            MODULE.MANAGED_AUDIO_PATH.fullmatch("../generated/private.flac")
        )

    def test_analysis_requires_a_storage_path_or_allowed_remote_url(self) -> None:
        with self.assertRaises(MODULE.RequestError) as context:
            MODULE.analyze_request(
                {
                    "sessionId": "test",
                    "sourceKind": "upload",
                    "fileName": "sample.mp3",
                    "mimeType": "audio/mpeg",
                }
            )
        self.assertEqual(context.exception.status, 400)

    def test_storage_cleanup_uses_a_json_delete_request(self) -> None:
        storage_path = (
            "incoming/2026-07-17/"
            "7ca268a0-4704-4cb0-85c2-2715bc4be149.flac"
        )
        with (
            patch.dict(
                os.environ,
                {
                    "SUPABASE_URL": "https://example.supabase.co",
                    "SUPABASE_SERVICE_ROLE_KEY": "service-key",
                    "SUPABASE_AUDIO_BUCKET": "audio-analysis",
                },
            ),
            patch.object(MODULE.httpx, "request") as request,
        ):
            MODULE._delete_storage_audio(storage_path)

        request.assert_called_once()
        args, kwargs = request.call_args
        self.assertEqual(args[0], "DELETE")
        self.assertEqual(kwargs["json"], {"prefixes": [storage_path]})

    def test_warm_query_is_detected_without_affecting_other_requests(self) -> None:
        self.assertTrue(MODULE._warm_requested("/api/audio-profile?warm=1"))
        self.assertFalse(MODULE._warm_requested("/api/audio-profile"))


if __name__ == "__main__":
    unittest.main()
