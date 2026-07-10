from __future__ import annotations

import unittest

from evaluation.compare import _label_evaluation, _meyda_moods


class EvaluationHelpersTest(unittest.TestCase):
    def test_top_three_hit_does_not_imply_top_one_hit(self) -> None:
        result = _label_evaluation(
            ["cello", "bowed-strings"],
            ["acoustic-guitar", "piano", "cello"],
        )

        self.assertTrue(result["anyHit"])
        self.assertFalse(result["top1Hit"])
        self.assertEqual(result["hits"], ["cello"])

    def test_meyda_mood_mapping_keeps_conflicting_rule_outputs_visible(self) -> None:
        labels = _meyda_moods("轻快、深沉、热烈")

        self.assertIn("joyful", labels)
        self.assertIn("melancholic", labels)
        self.assertIn("aggressive", labels)


if __name__ == "__main__":
    unittest.main()
