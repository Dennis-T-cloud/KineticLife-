from __future__ import annotations

from typing import Sequence

from app.ml.dtw_engine import JOINT_COUNT, AngleFrame

DEFAULT_SMOOTH_WINDOW = 5


def preprocess_frames(
    frames: Sequence[AngleFrame],
    *,
    smooth_window: int = DEFAULT_SMOOTH_WINDOW,
) -> list[AngleFrame]:
    """Fill None gaps (linear interp at the joint level) and smooth jitter.

    Keeps frame_id and ts_ms; only joint angles change. Joints that are None
    in every frame stay None — interpolation needs anchors on both sides.
    """
    if not frames:
        return []
    if smooth_window < 1:
        raise ValueError("smooth_window must be >= 1")

    columns = _frames_to_columns(frames)
    interpolated = [_interpolate_column(column) for column in columns]
    smoothed = [_smooth_column(column, smooth_window) for column in interpolated]

    return [
        AngleFrame(
            frame_id=frame.frame_id,
            ts_ms=frame.ts_ms,
            joint_angles=[smoothed[joint][index] for joint in range(JOINT_COUNT)],
        )
        for index, frame in enumerate(frames)
    ]


def _frames_to_columns(frames: Sequence[AngleFrame]) -> list[list[float | None]]:
    return [
        [frame.joint_angles[joint] for frame in frames]
        for joint in range(JOINT_COUNT)
    ]


def _interpolate_column(column: list[float | None]) -> list[float | None]:
    if not any(value is not None for value in column):
        return list(column)

    filled = list(column)
    first_valid = next(i for i, v in enumerate(filled) if v is not None)
    last_valid = max(i for i, v in enumerate(filled) if v is not None)

    for i in range(first_valid):
        filled[i] = filled[first_valid]
    for i in range(last_valid + 1, len(filled)):
        filled[i] = filled[last_valid]

    i = first_valid
    while i <= last_valid:
        if filled[i] is not None:
            i += 1
            continue
        gap_start = i - 1
        gap_end = i
        while gap_end <= last_valid and filled[gap_end] is None:
            gap_end += 1
        start_value = filled[gap_start]
        end_value = filled[gap_end]
        span = gap_end - gap_start
        for offset in range(1, span):
            ratio = offset / span
            filled[gap_start + offset] = start_value + ratio * (end_value - start_value)
        i = gap_end

    return filled


def _smooth_column(column: list[float | None], window: int) -> list[float | None]:
    if window <= 1:
        return list(column)
    radius = window // 2
    smoothed: list[float | None] = []
    for index in range(len(column)):
        start = max(0, index - radius)
        end = min(len(column), index + radius + 1)
        window_values = [value for value in column[start:end] if value is not None]
        smoothed.append(sum(window_values) / len(window_values) if window_values else None)
    return smoothed
