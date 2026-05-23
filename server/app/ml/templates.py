from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from app.ml.dtw_engine import AngleFrame, JOINT_COUNT

DEFAULT_TEMPLATE_DIR = Path(__file__).resolve().parents[2] / "data" / "templates"


@dataclass(frozen=True)
class ExerciseTemplate:
    template_id: str
    exercise: str
    display_name: str
    joint_angles_version: int
    source: str
    frame_rate_hz: int
    frames: list[AngleFrame]


def load_templates(template_dir: Path = DEFAULT_TEMPLATE_DIR) -> list[ExerciseTemplate]:
    if not template_dir.exists():
        raise FileNotFoundError(f"template directory not found: {template_dir}")

    templates = [
        load_template(path)
        for path in sorted(template_dir.glob("*.json"))
        if not _is_holder_template(path)
    ]
    _validate_unique_ids(templates)
    return templates


def _is_holder_template(path: Path) -> bool:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    return str(payload.get("source", "")).startswith("holder")


def load_template(path: Path) -> ExerciseTemplate:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return _template_from_payload(payload, path)


def get_template_by_exercise(
    exercise: str,
    template_dir: Path = DEFAULT_TEMPLATE_DIR,
) -> ExerciseTemplate:
    matches = [
        template
        for template in load_templates(template_dir)
        if template.exercise == exercise
    ]
    if not matches:
        raise KeyError(f"no template found for exercise: {exercise}")
    return matches[0]


def _template_from_payload(payload: dict, path: Path) -> ExerciseTemplate:
    required = (
        "template_id",
        "exercise",
        "display_name",
        "joint_angles_version",
        "source",
        "frame_rate_hz",
        "frames",
    )
    missing = [field for field in required if field not in payload]
    if missing:
        raise ValueError(f"{path} missing required fields: {', '.join(missing)}")

    frames = [_frame_from_payload(frame, index, path) for index, frame in enumerate(payload["frames"])]
    if not frames:
        raise ValueError(f"{path} must contain at least one frame")

    return ExerciseTemplate(
        template_id=str(payload["template_id"]),
        exercise=str(payload["exercise"]),
        display_name=str(payload["display_name"]),
        joint_angles_version=int(payload["joint_angles_version"]),
        source=str(payload["source"]),
        frame_rate_hz=int(payload["frame_rate_hz"]),
        frames=frames,
    )


def _frame_from_payload(payload: dict, index: int, path: Path) -> AngleFrame:
    try:
        joint_angles = payload["joint_angles"]
        frame_id = payload["frame_id"]
        ts_ms = payload["ts_ms"]
    except KeyError as exc:
        raise ValueError(f"{path} frame {index} missing field: {exc.args[0]}") from exc

    if not isinstance(joint_angles, list) or len(joint_angles) != JOINT_COUNT:
        raise ValueError(f"{path} frame {index} must contain {JOINT_COUNT} joint angles")

    return AngleFrame(
        frame_id=int(frame_id),
        ts_ms=int(ts_ms),
        joint_angles=[None if value is None else float(value) for value in joint_angles],
    )


def _validate_unique_ids(templates: Sequence[ExerciseTemplate]) -> None:
    seen: set[str] = set()
    for template in templates:
        if template.template_id in seen:
            raise ValueError(f"duplicate template_id: {template.template_id}")
        seen.add(template.template_id)
