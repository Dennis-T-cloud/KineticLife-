import unittest

from app.advice.rules import generate_coaching_text
from app.ml.dtw_engine import ErrorSpike


class AdviceRulesTests(unittest.TestCase):
    def test_generate_coaching_text_uses_dominant_joint_and_phase(self) -> None:
        tips = generate_coaching_text(
            [
                ErrorSpike(
                    start_step=2,
                    end_step=4,
                    peak_step=3,
                    peak_error=18,
                    average_error=15,
                    dominant_joint="trunk_lean",
                    dominant_joint_error=35,
                    phase="around the middle of the rep",
                )
            ],
            exercise="squat",
        )

        self.assertEqual(len(tips), 1)
        self.assertIn("squat", tips[0])
        self.assertIn("torso angle", tips[0])
        self.assertIn("around the middle of the rep", tips[0])

    def test_generate_coaching_text_limits_duplicate_joint_tips(self) -> None:
        tips = generate_coaching_text(
            [
                ErrorSpike(0, 1, 1, 25, 20, "left_knee", 22, "early in the rep"),
                ErrorSpike(2, 3, 2, 20, 18, "left_knee", 19, "near the end of the rep"),
                ErrorSpike(4, 5, 5, 19, 17, "right_hip", 20, "near the end of the rep"),
            ],
            max_tips=2,
        )

        self.assertEqual(len(tips), 2)
        self.assertNotEqual(tips[0], tips[1])

    def test_generate_coaching_text_has_fallback(self) -> None:
        self.assertEqual(
            generate_coaching_text([], exercise="pushup"),
            ["Your pushup stayed close to the reference; keep the same tempo and control."],
        )


if __name__ == "__main__":
    unittest.main()
