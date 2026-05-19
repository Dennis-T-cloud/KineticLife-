from __future__ import annotations

from dataclasses import dataclass
from math import inf, sqrt
from typing import Sequence

try:
    import numpy as _np

    _HAS_NUMPY = True
except ImportError:
    _np = None
    _HAS_NUMPY = False

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


@dataclass(frozen=True)
class AngleFrame:
    frame_id: int
    ts_ms: int
    joint_angles: Sequence[float | None]


@dataclass(frozen=True)
class AlignmentPair:
    user_index: int
    template_index: int


@dataclass(frozen=True)
class AlignedStepError:
    step_index: int
    user_index: int
    template_index: int
    user_frame_id: int
    ts_ms: int
    per_joint_error: dict[str, float | None]
    total_error: float


@dataclass(frozen=True)
class ErrorSpike:
    start_step: int
    end_step: int
    peak_step: int
    peak_error: float
    average_error: float
    dominant_joint: str
    dominant_joint_error: float
    phase: str


def compute_dtw_alignment_path(
    user_frames: Sequence[AngleFrame],
    template_frames: Sequence[AngleFrame],
    *,
    band_width: int | None = None,
) -> list[AlignmentPair]:
    """Compute a DTW path over the 14-D joint-angle frames.

    band_width: Sakoe-Chiba radius (max |i*cols/rows - j| allowed). None auto-derives
    a sensible default; pass 0 to disable banding (full O(N*M)).
    """
    _validate_frames(user_frames, "user_frames")
    _validate_frames(template_frames, "template_frames")

    rows = len(user_frames)
    cols = len(template_frames)
    radius = _resolve_band_width(rows, cols, band_width)

    if _HAS_NUMPY:
        cost = _build_cost_matrix_numpy(user_frames, template_frames, radius)
    else:
        cost = _build_cost_matrix_python(user_frames, template_frames, radius)

    return _backtrack_path(cost, rows, cols)


def compute_aligned_errors(
    user_frames: Sequence[AngleFrame],
    template_frames: Sequence[AngleFrame],
    alignment_path: Sequence[AlignmentPair] | None = None,
    *,
    band_width: int | None = None,
) -> list[AlignedStepError]:
    """Measure per-joint and total error at each aligned DTW step."""
    _validate_frames(user_frames, "user_frames")
    _validate_frames(template_frames, "template_frames")
    path = list(alignment_path) if alignment_path is not None else compute_dtw_alignment_path(
        user_frames,
        template_frames,
        band_width=band_width,
    )

    aligned_errors: list[AlignedStepError] = []
    for step_index, pair in enumerate(path):
        if pair.user_index < 0 or pair.user_index >= len(user_frames):
            raise ValueError(f"alignment_path[{step_index}].user_index is out of range")
        if pair.template_index < 0 or pair.template_index >= len(template_frames):
            raise ValueError(f"alignment_path[{step_index}].template_index is out of range")

        user_frame = user_frames[pair.user_index]
        template_frame = template_frames[pair.template_index]
        per_joint = _per_joint_error(user_frame, template_frame)
        total = _mean_valid(value for value in per_joint.values())
        aligned_errors.append(
            AlignedStepError(
                step_index=step_index,
                user_index=pair.user_index,
                template_index=pair.template_index,
                user_frame_id=user_frame.frame_id,
                ts_ms=user_frame.ts_ms,
                per_joint_error=per_joint,
                total_error=total,
            )
        )

    return aligned_errors


def detect_error_spikes(
    aligned_errors: Sequence[AlignedStepError],
    *,
    threshold: float | None = None,
    min_steps: int = 2,
    merge_gap: int = 1,
    smooth_window: int = 3,
) -> list[ErrorSpike]:
    """Find sustained DTW error spikes and attach dominant joint context."""
    if not aligned_errors:
        return []
    if min_steps <= 0:
        raise ValueError("min_steps must be positive")
    if merge_gap < 0:
        raise ValueError("merge_gap must be non-negative")

    smoothed = _moving_average([step.total_error for step in aligned_errors], smooth_window)
    spike_threshold = threshold if threshold is not None else _default_spike_threshold(smoothed)
    raw_segments = _segments_above_threshold(smoothed, spike_threshold)
    merged_segments = _merge_nearby_segments(raw_segments, merge_gap)

    spikes: list[ErrorSpike] = []
    for start, end in merged_segments:
        if end - start + 1 < min_steps:
            continue
        segment_values = smoothed[start : end + 1]
        peak_offset, peak_error = max(enumerate(segment_values), key=lambda item: item[1])
        peak_step = start + peak_offset
        dominant_joint, dominant_error = _dominant_joint(aligned_errors[start : end + 1])
        spikes.append(
            ErrorSpike(
                start_step=start,
                end_step=end,
                peak_step=peak_step,
                peak_error=peak_error,
                average_error=sum(segment_values) / len(segment_values),
                dominant_joint=dominant_joint,
                dominant_joint_error=dominant_error,
                phase=_phase_for_step(peak_step, len(aligned_errors)),
            )
        )

    return sorted(spikes, key=lambda spike: spike.peak_error, reverse=True)


def _validate_frames(frames: Sequence[AngleFrame], name: str) -> None:
    if not frames:
        raise ValueError(f"{name} cannot be empty")
    any_valid_joint = False
    for index, frame in enumerate(frames):
        if len(frame.joint_angles) != JOINT_COUNT:
            raise ValueError(
                f"{name}[{index}].joint_angles must contain {JOINT_COUNT} values"
            )
        if any(angle is not None for angle in frame.joint_angles):
            any_valid_joint = True
    if not any_valid_joint:
        raise ValueError(f"{name} contains no valid joint angles (every value is None)")


def _resolve_band_width(rows: int, cols: int, band_width: int | None) -> int:
    """Sakoe-Chiba radius. None -> auto (max(5, longer_seq // 4)); 0 -> unbanded."""
    if band_width is None:
        return max(5, max(rows, cols) // 4)
    if band_width < 0:
        raise ValueError("band_width must be >= 0 (0 disables banding)")
    if band_width == 0:
        return max(rows, cols)
    min_required = abs(rows - cols)
    return max(band_width, min_required)


def _in_band(i: int, j: int, rows: int, cols: int, radius: int) -> bool:
    if rows <= 0 or cols <= 0:
        return True
    projected_j = (i - 1) * cols / rows
    return abs(projected_j - (j - 1)) <= radius


def _build_cost_matrix_python(
    user_frames: Sequence[AngleFrame],
    template_frames: Sequence[AngleFrame],
    radius: int,
) -> list[list[float]]:
    rows = len(user_frames)
    cols = len(template_frames)
    cost = [[inf] * (cols + 1) for _ in range(rows + 1)]
    cost[0][0] = 0.0

    for i in range(1, rows + 1):
        for j in range(1, cols + 1):
            if not _in_band(i, j, rows, cols, radius):
                continue
            local = _frame_distance(user_frames[i - 1], template_frames[j - 1])
            cost[i][j] = local + min(
                cost[i - 1][j],
                cost[i][j - 1],
                cost[i - 1][j - 1],
            )
    return cost


def _build_cost_matrix_numpy(
    user_frames: Sequence[AngleFrame],
    template_frames: Sequence[AngleFrame],
    radius: int,
) -> list[list[float]]:
    """Vectorized local-distance computation; DP recurrence stays sequential."""
    rows = len(user_frames)
    cols = len(template_frames)

    user_matrix = _frames_to_array(user_frames)
    template_matrix = _frames_to_array(template_frames)
    user_valid = ~_np.isnan(user_matrix)
    template_valid = ~_np.isnan(template_matrix)

    user_filled = _np.where(user_valid, user_matrix, 0.0)
    template_filled = _np.where(template_valid, template_matrix, 0.0)

    diff = _np.abs(user_filled[:, None, :] - template_filled[None, :, :])
    pair_valid = user_valid[:, None, :] & template_valid[None, :, :]
    diff = _np.where(pair_valid, diff, 0.0)

    valid_counts = pair_valid.sum(axis=2)
    sums = diff.sum(axis=2)
    local_costs = _np.where(valid_counts > 0, sums / _np.maximum(valid_counts, 1), 0.0)

    cost = [[inf] * (cols + 1) for _ in range(rows + 1)]
    cost[0][0] = 0.0
    for i in range(1, rows + 1):
        row_costs = cost[i]
        prev_row = cost[i - 1]
        local_row = local_costs[i - 1]
        for j in range(1, cols + 1):
            if not _in_band(i, j, rows, cols, radius):
                continue
            row_costs[j] = float(local_row[j - 1]) + min(
                prev_row[j],
                row_costs[j - 1],
                prev_row[j - 1],
            )
    return cost


def _frames_to_array(frames: Sequence[AngleFrame]):
    return _np.array(
        [[_np.nan if v is None else float(v) for v in frame.joint_angles] for frame in frames],
        dtype=float,
    )


def _backtrack_path(cost: list[list[float]], rows: int, cols: int) -> list[AlignmentPair]:
    if cost[rows][cols] == inf:
        raise ValueError(
            "DTW alignment failed: band_width too small for these sequence lengths"
        )
    i, j = rows, cols
    path: list[AlignmentPair] = []
    while i > 0 and j > 0:
        path.append(AlignmentPair(user_index=i - 1, template_index=j - 1))
        previous = (
            (cost[i - 1][j - 1], i - 1, j - 1),
            (cost[i - 1][j], i - 1, j),
            (cost[i][j - 1], i, j - 1),
        )
        _, i, j = min(previous, key=lambda item: item[0])
    path.reverse()
    return path


def _frame_distance(user_frame: AngleFrame, template_frame: AngleFrame) -> float:
    return _mean_valid(_per_joint_error(user_frame, template_frame).values())


def _per_joint_error(
    user_frame: AngleFrame,
    template_frame: AngleFrame,
) -> dict[str, float | None]:
    errors: dict[str, float | None] = {}
    for name, user_angle, template_angle in zip(
        JOINT_NAMES,
        user_frame.joint_angles,
        template_frame.joint_angles,
        strict=True,
    ):
        errors[name] = None if user_angle is None or template_angle is None else abs(
            user_angle - template_angle
        )
    return errors


def _mean_valid(values: Sequence[float | None] | object) -> float:
    valid = [value for value in values if value is not None]
    if not valid:
        return 0.0
    return sum(valid) / len(valid)


def _moving_average(values: Sequence[float], window: int) -> list[float]:
    if window <= 1:
        return list(values)
    radius = window // 2
    smoothed: list[float] = []
    for index in range(len(values)):
        start = max(0, index - radius)
        end = min(len(values), index + radius + 1)
        smoothed.append(sum(values[start:end]) / (end - start))
    return smoothed


def _default_spike_threshold(values: Sequence[float]) -> float:
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return max(12.0, mean + sqrt(variance))


def _segments_above_threshold(values: Sequence[float], threshold: float) -> list[tuple[int, int]]:
    segments: list[tuple[int, int]] = []
    start: int | None = None
    for index, value in enumerate(values):
        if value >= threshold and start is None:
            start = index
        elif value < threshold and start is not None:
            segments.append((start, index - 1))
            start = None
    if start is not None:
        segments.append((start, len(values) - 1))
    return segments


def _merge_nearby_segments(
    segments: Sequence[tuple[int, int]],
    merge_gap: int,
) -> list[tuple[int, int]]:
    if not segments:
        return []
    merged = [segments[0]]
    for start, end in segments[1:]:
        previous_start, previous_end = merged[-1]
        if start - previous_end - 1 <= merge_gap:
            merged[-1] = (previous_start, end)
        else:
            merged.append((start, end))
    return merged


def _dominant_joint(steps: Sequence[AlignedStepError]) -> tuple[str, float]:
    totals = {name: 0.0 for name in JOINT_NAMES}
    counts = {name: 0 for name in JOINT_NAMES}
    for step in steps:
        for name, value in step.per_joint_error.items():
            if value is not None:
                totals[name] += value
                counts[name] += 1

    averages = {
        name: totals[name] / counts[name] if counts[name] else 0.0
        for name in JOINT_NAMES
    }
    dominant = max(averages, key=averages.get)
    return dominant, averages[dominant]


def _phase_for_step(step_index: int, total_steps: int) -> str:
    if total_steps <= 1:
        return "throughout the rep"
    progress = step_index / (total_steps - 1)
    if progress < 0.34:
        return "early in the rep"
    if progress < 0.67:
        return "around the middle of the rep"
    return "near the end of the rep"
