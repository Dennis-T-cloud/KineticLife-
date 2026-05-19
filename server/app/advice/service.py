from __future__ import annotations

from dataclasses import asdict

from app.advice.rules import generate_coaching_text
from app.contracts import (
    AlignedStepErrorPayload,
    AlignmentPairPayload,
    AngleFramePayload,
    CoachingAnalysisRequest,
    CoachingAnalysisResponse,
    ErrorSpikePayload,
)
from app.ml.dtw_engine import (
    AlignmentPair,
    AngleFrame,
    compute_aligned_errors,
    compute_dtw_alignment_path,
    detect_error_spikes,
)
from app.ml.preprocessing import preprocess_frames
from app.ml.templates import get_template_by_exercise
from app.ml.thresholds import DEFAULT_THRESHOLD_CONFIG, get_threshold_config

_REQUEST_DEFAULTS = (
    ("min_spike_steps", "min_steps"),
    ("merge_gap", "merge_gap"),
    ("smooth_window", "smooth_window"),
)


def analyze_coaching_request(request: CoachingAnalysisRequest) -> CoachingAnalysisResponse:
    raw_user_frames = [_to_angle_frame(frame) for frame in request.user_frames]
    raw_template_frames = _resolve_template_frames(request)

    user_frames = preprocess_frames(raw_user_frames)
    template_frames = preprocess_frames(raw_template_frames)

    alignment_path = (
        [_to_alignment_pair(pair) for pair in request.alignment_path]
        if request.alignment_path is not None
        else compute_dtw_alignment_path(user_frames, template_frames)
    )

    aligned_errors = compute_aligned_errors(
        user_frames,
        template_frames,
        alignment_path,
    )

    spike_kwargs = _resolve_spike_kwargs(request)
    spikes = detect_error_spikes(aligned_errors, **spike_kwargs)
    tips = generate_coaching_text(
        spikes,
        exercise=request.exercise,
        max_tips=request.max_tips,
    )

    return CoachingAnalysisResponse(
        exercise=request.exercise,
        tips=tips,
        alignment_path=[AlignmentPairPayload(**asdict(pair)) for pair in alignment_path],
        aligned_errors=[AlignedStepErrorPayload(**asdict(error)) for error in aligned_errors],
        spikes=[ErrorSpikePayload(**asdict(spike)) for spike in spikes],
    )


def _resolve_spike_kwargs(request: CoachingAnalysisRequest) -> dict:
    config = get_threshold_config(request.exercise)
    threshold = request.spike_threshold if request.spike_threshold is not None else config.spike_threshold
    kwargs: dict = {"threshold": threshold}
    for request_field, kwarg_name in _REQUEST_DEFAULTS:
        request_value = getattr(request, request_field)
        default_value = getattr(DEFAULT_THRESHOLD_CONFIG, kwarg_name)
        config_value = getattr(config, kwarg_name)
        kwargs[kwarg_name] = config_value if request_value == default_value else request_value
    return kwargs


def _resolve_template_frames(request: CoachingAnalysisRequest) -> list[AngleFrame]:
    if request.template_frames is not None:
        return [_to_angle_frame(frame) for frame in request.template_frames]
    if request.exercise is None:
        raise ValueError("exercise is required when template_frames are omitted")
    return get_template_by_exercise(request.exercise).frames


def _to_angle_frame(payload: AngleFramePayload) -> AngleFrame:
    return AngleFrame(
        frame_id=payload.frame_id,
        ts_ms=payload.ts_ms,
        joint_angles=payload.joint_angles,
    )


def _to_alignment_pair(payload: AlignmentPairPayload) -> AlignmentPair:
    return AlignmentPair(
        user_index=payload.user_index,
        template_index=payload.template_index,
    )
