import gzip
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="KineticLife API", version="0.3.0")

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
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/api/actions", response_model=ActionResponse)
async def submit_action(body: ActionSubmit) -> ActionResponse:
    """
    Receive a segmented rep from the client.
    DTW scoring is stubbed — replace with dtw_engine.py in W3.
    """
    # Stub DTW result (placeholder until ml/dtw_engine.py is implemented)
    dtw_distance = 0.0
    completeness = 1.0
    correct = True
    problem_joints: list[ProblemJoint] = []

    # Compress and store frames
    frames_payload = [f.model_dump() for f in body.frames]
    compressed = gzip.compress(json.dumps(frames_payload).encode())

    _actions[body.action_id] = {
        "action_id": body.action_id,
        "session_id": body.session_id,
        "exercise": body.exercise_hint,
        "correct": correct,
        "dtw_distance": dtw_distance,
        "completeness": completeness,
        "problem_joints": [p.model_dump() for p in problem_joints],
        "frames_compressed": compressed,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    return ActionResponse(
        action_id=body.action_id,
        exercise=body.exercise_hint,
        correct=correct,
        dtw_distance=dtw_distance,
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
