import gzip
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.ml.dtw_engine import (
    AngleFrame,
    compute_aligned_errors,
    compute_dtw_alignment_path,
    detect_error_spikes,
)
from app.ml.preprocessing import preprocess_frames
from app.ml.templates import ExerciseTemplate, load_templates
from app.ml.thresholds import get_threshold_config

app = FastAPI(title="KineticLife API", version="0.4.0")

# Key joint indices per exercise (matches JOINT_NAMES in dtw_engine.py)
# Used to extract the single representative angle for chart display
_KEY_JOINTS: dict[str, list[int]] = {
    "squat":            [0, 1],   # left_knee + right_knee
    "barbell_squat":    [0, 1],
    "deadlift":         [4, 5],   # left_hip  + right_hip
    "bicep_curl":       [3],      # right_elbow
    "right_bicep_curl": [2],      # left_elbow
    "lateral_raise":    [6, 7],   # left_shoulder + right_shoulder
    "squat_side":       [0, 1],   # left_knee + right_knee (side-view squat)
    "both_bicep_curl":  [2, 3],   # left_elbow + right_elbow
}

# ---------------------------------------------------------------------------
# Template cache — loaded once at startup
# ---------------------------------------------------------------------------
_templates: list[ExerciseTemplate] = []


@app.on_event("startup")
async def _load_templates() -> None:
    global _templates
    _templates = load_templates()


# ---------------------------------------------------------------------------
# In-memory store (replaces DB until Postgres/Alembic is wired up)
# ---------------------------------------------------------------------------
_actions: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Pydantic models  (translated from 04_Interface_Contracts.md §3.5 / §4)
# ---------------------------------------------------------------------------

class FrameIn(BaseModel):
    frame_id: int
    ts_ms: int
    joint_angles: list[float | None]   # 14-D; null = low-visibility


class ActionSubmit(BaseModel):
    v: int = 1
    type: str = "client.action_submit"
    session_id: str
    action_id: str
    exercise_hint: str
    ts_start_ms: int
    ts_end_ms: int
    frames: list[FrameIn]


class ProblemJoint(BaseModel):
    joint: str
    severity: float
    issue: str


class ActionResponse(BaseModel):
    action_id: str
    exercise: str
    correct: bool
    dtw_distance: float
    completeness: float
    problem_joints: list[ProblemJoint]
    processed_at: str


class HistoryFrame(BaseModel):
    frame_id: int
    ts_ms: int
    joint_angles: list[float | None]


class HistoryResponse(BaseModel):
    action_id: str
    exercise: str
    correct: bool
    dtw_distance: float
    completeness: float
    problem_joints: list[dict]
    frames: list[HistoryFrame]


# ---------------------------------------------------------------------------
# DTW helpers
# ---------------------------------------------------------------------------

def _to_angle_frames(frames: list[FrameIn]) -> list[AngleFrame]:
    return [
        AngleFrame(frame_id=f.frame_id, ts_ms=f.ts_ms, joint_angles=f.joint_angles)
        for f in frames
    ]


def _normalized_dtw_distance(
    user_frames: list[AngleFrame],
    template: ExerciseTemplate,
) -> float:
    """Mean per-step total error along the DTW alignment path."""
    tmpl_frames = preprocess_frames(template.frames)
    path = compute_dtw_alignment_path(user_frames, tmpl_frames)
    errors = compute_aligned_errors(user_frames, tmpl_frames, path)
    if not errors:
        return float("inf")
    return sum(e.total_error for e in errors) / len(errors)


def _classify(user_frames: list[AngleFrame], hint: str) -> tuple[ExerciseTemplate, float]:
    """
    Method 2: score against all templates, return (best_template, distance).
    Falls back to hint-matched template if no templates are loaded.
    """
    if not _templates:
        raise HTTPException(status_code=503, detail="templates not loaded")

    best_tmpl: ExerciseTemplate | None = None
    best_dist = float("inf")

    for tmpl in _templates:
        try:
            dist = _normalized_dtw_distance(user_frames, tmpl)
        except Exception:
            continue
        if dist < best_dist:
            best_dist = dist
            best_tmpl = tmpl

    if best_tmpl is None:
        # Fallback: use exercise_hint
        matches = [t for t in _templates if t.exercise == hint]
        if not matches:
            raise HTTPException(status_code=422, detail=f"no template for exercise: {hint}")
        best_tmpl = matches[0]
        best_dist = _normalized_dtw_distance(user_frames, best_tmpl)

    return best_tmpl, best_dist


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/templates")
async def get_template_signals() -> dict[str, list[float]]:
    """
    Return the key-angle time series for every loaded template.
    Values are raw frame angles (not resampled) — client resamples to fit the chart.
    Response: { "squat": [154.2, 152.1, ...], "bicep_curl": [...], ... }
    """
    if not _templates:
        raise HTTPException(status_code=503, detail="templates not loaded")

    result: dict[str, list[float]] = {}
    for tmpl in _templates:
        joints = _KEY_JOINTS.get(tmpl.exercise)
        if joints is None:
            continue
        signal = [
            round(sum(f.joint_angles[j] or 0.0 for j in joints) / len(joints), 1)
            for f in tmpl.frames
        ]
        result[tmpl.exercise] = signal
    return result


@app.post("/api/actions", response_model=ActionResponse)
async def submit_action(body: ActionSubmit) -> ActionResponse:
    raw_user_frames = _to_angle_frames(body.frames)
    user_frames = preprocess_frames(raw_user_frames)

    # Classify via multi-template DTW (Method 2)
    best_tmpl, dtw_distance = _classify(user_frames, body.exercise_hint)
    classified_exercise = best_tmpl.exercise

    # Full error analysis against best-matching template
    tmpl_frames = preprocess_frames(best_tmpl.frames)
    path = compute_dtw_alignment_path(user_frames, tmpl_frames)
    aligned_errors = compute_aligned_errors(user_frames, tmpl_frames, path)

    cfg = get_threshold_config(classified_exercise)
    spikes = detect_error_spikes(
        aligned_errors,
        threshold=cfg.spike_threshold,
        min_steps=cfg.min_steps,
        merge_gap=cfg.merge_gap,
        smooth_window=cfg.smooth_window,
    )

    # Derive problem joints from spikes
    problem_joints: list[ProblemJoint] = [
        ProblemJoint(
            joint=spike.dominant_joint,
            severity=round(min(spike.dominant_joint_error / 20.0, 1.0), 3),
            issue="deviation",
        )
        for spike in spikes
    ]

    # Correct = no error spikes detected; completeness = 1 - normalised distance
    correct = len(spikes) == 0
    threshold = cfg.spike_threshold or 12.0
    completeness = round(max(0.0, 1.0 - dtw_distance / threshold), 3)

    # Persist
    frames_payload = [f.model_dump() for f in body.frames]
    compressed = gzip.compress(json.dumps(frames_payload).encode())
    _actions[body.action_id] = {
        "action_id":        body.action_id,
        "session_id":       body.session_id,
        "exercise":         classified_exercise,
        "correct":          correct,
        "dtw_distance":     dtw_distance,
        "completeness":     completeness,
        "problem_joints":   [p.model_dump() for p in problem_joints],
        "frames_compressed": compressed,
        "created_at":       datetime.now(timezone.utc).isoformat(),
    }

    return ActionResponse(
        action_id=body.action_id,
        exercise=classified_exercise,
        correct=correct,
        dtw_distance=round(dtw_distance, 4),
        completeness=completeness,
        problem_joints=problem_joints,
        processed_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/api/history/{action_id}", response_model=HistoryResponse)
async def get_action_history(action_id: str) -> HistoryResponse:
    row = _actions.get(action_id)
    if not row:
        raise HTTPException(status_code=404, detail="action not found")

    raw: list[dict[str, Any]] = json.loads(gzip.decompress(row["frames_compressed"]))
    frames = [
        HistoryFrame(
            frame_id=f["frame_id"],
            ts_ms=f["ts_ms"],
            joint_angles=f["joint_angles"],
        )
        for f in raw
    ]

    return HistoryResponse(
        action_id=row["action_id"],
        exercise=row["exercise"],
        correct=row["correct"],
        dtw_distance=row["dtw_distance"],
        completeness=row["completeness"],
        problem_joints=row["problem_joints"],
        frames=frames,
    )
