from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from statistics import fmean
from typing import Iterable, Sequence

JOINT_NAMES: tuple[str, ...] = (
    "left_knee",
    "right_knee",
    "left_elbow",
    "right_elbow",
    "left_hip",
    "right_hip",
    "left_shoulder",
    "right_shoulder",
    "left_ankle",
    "right_ankle",
    "left_wrist",
    "right_wrist",
    "trunk_lean",
    "pelvis_tilt",
)

JOINT_COUNT = len(JOINT_NAMES)


def load_timeseries(path: Path) -> list[list[float | None]]:
    if path.suffix.lower() == ".csv":
        return _load_csv(path)
    return _load_json(path)


def calculate_variance(series: Sequence[Sequence[float | None]]) -> dict:
    if not series:
        raise ValueError("time series cannot be empty")

    _validate_series(series)
    per_joint = []
    all_valid_values: list[float] = []

    for joint_index, joint_name in enumerate(JOINT_NAMES):
        values = [
            frame[joint_index]
            for frame in series
            if frame[joint_index] is not None
        ]
        valid = [float(value) for value in values if value is not None]
        all_valid_values.extend(valid)
        per_joint.append(
            {
                "joint": joint_name,
                "count": len(valid),
                "mean": _mean(valid),
                "variance": _population_variance(valid),
                "stddev": _population_variance(valid) ** 0.5,
                "min": min(valid) if valid else None,
                "max": max(valid) if valid else None,
            }
        )

    return {
        "frame_count": len(series),
        "joint_count": JOINT_COUNT,
        "valid_value_count": len(all_valid_values),
        "overall_mean": _mean(all_valid_values),
        "overall_variance": _population_variance(all_valid_values),
        "per_joint": per_joint,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Calculate variance for KineticLife joint-angle time series.",
    )
    parser.add_argument("input", type=Path, help="Path to JSON or CSV time-series data.")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        help="Optional path for writing the JSON summary.",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output.",
    )
    args = parser.parse_args()

    summary = calculate_variance(load_timeseries(args.input))
    text = json.dumps(summary, indent=2 if args.pretty else None)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    else:
        print(text)


def _load_json(path: Path) -> list[list[float | None]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        if "frames" in data:
            data = data["frames"]
        elif "joint_angles" in data:
            data = data["joint_angles"]

    frames = []
    for item in data:
        if isinstance(item, dict):
            item = item.get("joint_angles")
        frames.append(_coerce_frame(item))
    return frames


def _load_csv(path: Path) -> list[list[float | None]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames and all(name in reader.fieldnames for name in JOINT_NAMES):
            return [
                [_coerce_number(row[name]) for name in JOINT_NAMES]
                for row in reader
            ]

    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        return [_coerce_frame(row) for row in reader]


def _validate_series(series: Sequence[Sequence[float | None]]) -> None:
    for index, frame in enumerate(series):
        if len(frame) != JOINT_COUNT:
            raise ValueError(
                f"frame {index} must contain {JOINT_COUNT} joint-angle values"
            )


def _coerce_frame(item: object) -> list[float | None]:
    if not isinstance(item, list):
        raise ValueError("each frame must be a list of joint-angle values")
    if len(item) != JOINT_COUNT:
        raise ValueError(f"each frame must contain {JOINT_COUNT} joint-angle values")
    return [_coerce_number(value) for value in item]


def _coerce_number(value: object) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _mean(values: Sequence[float]) -> float | None:
    if not values:
        return None
    return fmean(values)


def _population_variance(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    mean = fmean(values)
    return fmean((value - mean) ** 2 for value in values)


if __name__ == "__main__":
    main()
