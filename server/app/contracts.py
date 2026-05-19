from __future__ import annotations

from pydantic import BaseModel, Field

from app.ml.dtw_engine import JOINT_COUNT


class AngleFramePayload(BaseModel):
    frame_id: int
    ts_ms: int
    joint_angles: list[float | None] = Field(
        min_length=JOINT_COUNT,
        max_length=JOINT_COUNT,
    )


class AlignmentPairPayload(BaseModel):
    user_index: int
    template_index: int


class AlignedStepErrorPayload(BaseModel):
    step_index: int
    user_index: int
    template_index: int
    user_frame_id: int
    ts_ms: int
    per_joint_error: dict[str, float | None]
    total_error: float


class ErrorSpikePayload(BaseModel):
    start_step: int
    end_step: int
    peak_step: int
    peak_error: float
    average_error: float
    dominant_joint: str
    dominant_joint_error: float
    phase: str


class CoachingAnalysisRequest(BaseModel):
    exercise: str | None = None
    user_frames: list[AngleFramePayload] = Field(min_length=1)
    template_frames: list[AngleFramePayload] | None = None
    alignment_path: list[AlignmentPairPayload] | None = None
    spike_threshold: float | None = None
    min_spike_steps: int = Field(default=2, ge=1)
    merge_gap: int = Field(default=1, ge=0)
    smooth_window: int = Field(default=3, ge=1)
    max_tips: int = Field(default=2, ge=0)


class CoachingAnalysisResponse(BaseModel):
    exercise: str | None
    tips: list[str]
    alignment_path: list[AlignmentPairPayload]
    aligned_errors: list[AlignedStepErrorPayload]
    spikes: list[ErrorSpikePayload]


class MockFrontendResponse(BaseModel):
    scenario: str
    session_id: str
    messages: list[dict]
