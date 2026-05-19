import unittest

from app.ml.thresholds import (
    DEFAULT_THRESHOLD_CONFIG,
    EXERCISE_THRESHOLDS,
    get_threshold_config,
)


class ThresholdLookupTests(unittest.TestCase):
    def test_known_exercise_returns_specific_config(self) -> None:
        self.assertEqual(get_threshold_config("squat"), EXERCISE_THRESHOLDS["squat"])

    def test_unknown_exercise_falls_back_to_default(self) -> None:
        self.assertEqual(get_threshold_config("snatch"), DEFAULT_THRESHOLD_CONFIG)

    def test_none_exercise_returns_default(self) -> None:
        self.assertEqual(get_threshold_config(None), DEFAULT_THRESHOLD_CONFIG)


if __name__ == "__main__":
    unittest.main()
