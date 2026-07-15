from __future__ import annotations

import unittest

from app.main import _is_allowed_remote_url


class RemoteAudioSecurityTest(unittest.TestCase):
    def test_allows_jamendo_https_hosts(self) -> None:
        self.assertTrue(_is_allowed_remote_url("https://prod-1.storage.jamendo.com/audio.mp3"))
        self.assertTrue(_is_allowed_remote_url("https://jamendo.com/audio.mp3"))

    def test_rejects_non_https_credentials_and_lookalike_hosts(self) -> None:
        self.assertFalse(_is_allowed_remote_url("http://prod-1.storage.jamendo.com/audio.mp3"))
        self.assertFalse(_is_allowed_remote_url("https://user@jamendo.com/audio.mp3"))
        self.assertFalse(_is_allowed_remote_url("https://jamendo.com.example.org/audio.mp3"))
        self.assertFalse(_is_allowed_remote_url("https://127.0.0.1/audio.mp3"))


if __name__ == "__main__":
    unittest.main()
