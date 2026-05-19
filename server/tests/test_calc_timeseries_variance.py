import json
import tempfile
import unittest
from pathlib import Path

from scripts.calc_timeseries_variance import calculate_variance, load_timeseries


def frame(value: float) -> list[float]:
    return [value] * 14


class CalcTimeseriesVarianceTests(unittest.TestCase):
    def test_calculate_variance_returns_overall_and_per_joint_stats(self) -> None:
        series = [frame(100), frame(110), frame(120)]

        summary = calculate_variance(series)

        self.assertEqual(summary["frame_count"], 3)
        self.assertEqual(summary["joint_count"], 14)
        self.assertEqual(summary["overall_mean"], 110)
        self.assertEqual(round(summary["overall_variance"], 4), 66.6667)
        self.assertEqual(summary["per_joint"][0]["joint"], "left_knee")
        self.assertEqual(round(summary["per_joint"][0]["stddev"], 4), 8.165)

    def test_calculate_variance_ignores_missing_values(self) -> None:
        first = frame(100)
        second = frame(100)
        second[0] = None

        summary = calculate_variance([first, second])

        self.assertEqual(summary["valid_value_count"], 27)
        self.assertEqual(summary["per_joint"][0]["count"], 1)
        self.assertEqual(summary["per_joint"][0]["variance"], 0)

    def test_load_timeseries_supports_json_frame_objects(self) -> None:
        payload = {
            "frames": [
                {"joint_angles": frame(100)},
                {"joint_angles": frame(120)},
            ]
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "series.json"
            path.write_text(json.dumps(payload), encoding="utf-8")

            loaded = load_timeseries(path)

        self.assertEqual(len(loaded), 2)
        self.assertEqual(loaded[1][0], 120)

    def test_load_timeseries_supports_csv_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "series.csv"
            path.write_text(
                ",".join(["100"] * 14) + "\n" + ",".join(["120"] * 14) + "\n",
                encoding="utf-8",
            )

            loaded = load_timeseries(path)

        self.assertEqual(len(loaded), 2)
        self.assertEqual(loaded[0][13], 100)


if __name__ == "__main__":
    unittest.main()
