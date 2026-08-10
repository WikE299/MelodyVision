from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import soundfile as sf

from app.analyzer import MusicAnalyzer
from app.semantic import ClapSemanticAnalyzer


class MusicAnalyzerTest(unittest.TestCase):
    def test_signal_warmup_only_runs_once(self) -> None:
        analyzer = MusicAnalyzer(ClapSemanticAnalyzer(enabled=False))
        with patch.object(analyzer, "_signal_features", return_value={}) as signal_features:
            analyzer.warmup()
            analyzer.warmup()

        signal_features.assert_called_once()

    def test_signal_profile_matches_version_two_contract(self) -> None:
        sample_rate = 22_050
        seconds = 12
        time = np.arange(sample_rate * seconds) / sample_rate
        audio = np.sin(2 * np.pi * 220 * time) * np.linspace(0.15, 0.75, len(time))
        audio[len(audio) // 2 :] += 0.25 * np.sin(2 * np.pi * 440 * time[len(audio) // 2 :])

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.wav"
            sf.write(path, audio, sample_rate)
            analyzer = MusicAnalyzer(ClapSemanticAnalyzer(enabled=False))
            profile = analyzer.analyze_file(
                path,
                session_id="test-session",
                source_kind="preset",
                catalog_item_id="fixture-audio",
            )

        self.assertEqual(profile["schemaVersion"], "2.0.0")
        self.assertEqual(profile["sessionId"], "test-session")
        self.assertEqual(profile["audio"]["catalogItemId"], "fixture-audio")
        self.assertNotIn("visualHints", profile)
        self.assertGreaterEqual(len(profile["sections"]), 1)
        self.assertIn("rhythm", profile)
        self.assertIn("tonality", profile)
        self.assertIn("dynamics", profile)
        self.assertIn("timbre", profile)
        self.assertIn("semantics", profile)
        self.assertTrue(
            any(warning["code"] == "semantic_analysis_unavailable" for warning in profile["warnings"])
        )

    def test_section_phases_do_not_invent_an_interior_climax(self) -> None:
        sections = [
            {"energy": 0.2, "phase": "unknown"},
            {"energy": 0.4, "phase": "unknown"},
            {"energy": 0.5, "phase": "unknown"},
            {"energy": 0.8, "phase": "unknown"},
        ]

        MusicAnalyzer._assign_section_phases(sections)

        self.assertEqual(
            [section["phase"] for section in sections],
            ["opening", "development", "turning-point", "ending"],
        )

    def test_section_phases_keep_a_dominant_local_peak_as_climax(self) -> None:
        sections = [
            {"energy": 0.2, "phase": "unknown"},
            {"energy": 0.9, "phase": "unknown"},
            {"energy": 0.4, "phase": "unknown"},
            {"energy": 0.3, "phase": "unknown"},
        ]

        MusicAnalyzer._assign_section_phases(sections)

        self.assertEqual(
            [section["phase"] for section in sections],
            ["opening", "climax", "release", "ending"],
        )

    def test_high_tempo_exposes_octave_ambiguity(self) -> None:
        warnings = MusicAnalyzer._tempo_warnings(144.0)

        self.assertEqual(warnings[0]["code"], "tempo_octave_ambiguity")
        self.assertIn("72.00 BPM", warnings[0]["message"])

    def test_tempo_estimation_uses_onset_periodicity(self) -> None:
        onset_envelope = np.zeros(240)
        onset_envelope[::20] = 1

        bpm, beat_lag = MusicAnalyzer._estimate_tempo(onset_envelope, 22_050)

        self.assertEqual(beat_lag, 20)
        self.assertAlmostEqual(bpm, 129.2, places=1)


if __name__ == "__main__":
    unittest.main()
