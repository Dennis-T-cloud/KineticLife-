from __future__ import annotations

from dataclasses import dataclass

DEFAULT_BAND_DIVISOR = 4


@dataclass(frozen=True)
class SpikeThresholdConfig:
    """Per-exercise spike-detection knobs.

    spike_threshold: degrees of mean joint deviation considered a spike.
                     None lets dtw_engine fall back to mean+1sigma (floor 12).
    min_steps:       minimum aligned steps a spike must span to count.
    merge_gap:       merge two near-spikes if they're this close in aligned steps.
    smooth_window:   centered moving-average window over the error series.
    """

    spike_threshold: float | None
    min_steps: int
    merge_gap: int
    smooth_window: int


DEFAULT_THRESHOLD_CONFIG = SpikeThresholdConfig(
    spike_threshold=None,
    min_steps=2,
    merge_gap=1,
    smooth_window=3,
)

EXERCISE_THRESHOLDS: dict[str, SpikeThresholdConfig] = {
    "squat": SpikeThresholdConfig(
        spike_threshold=4.0,
        min_steps=3,
        merge_gap=1,
        smooth_window=5,
    ),
    "barbell_squat": SpikeThresholdConfig(
        spike_threshold=4.0,
        min_steps=3,
        merge_gap=1,
        smooth_window=5,
    ),
    "deadlift": SpikeThresholdConfig(
        spike_threshold=5.0,
        min_steps=3,
        merge_gap=2,
        smooth_window=5,
    ),
    "bicep_curl": SpikeThresholdConfig(
        spike_threshold=3.5,
        min_steps=2,
        merge_gap=1,
        smooth_window=3,
    ),
    "right_bicep_curl": SpikeThresholdConfig(
        spike_threshold=3.5,
        min_steps=2,
        merge_gap=1,
        smooth_window=3,
    ),
    "lateral_raise": SpikeThresholdConfig(
        spike_threshold=3.0,
        min_steps=2,
        merge_gap=1,
        smooth_window=3,
    ),
    "squat_side": SpikeThresholdConfig(
        spike_threshold=4.0,
        min_steps=3,
        merge_gap=1,
        smooth_window=5,
    ),
    "both_bicep_curl": SpikeThresholdConfig(
        spike_threshold=3.5,
        min_steps=2,
        merge_gap=1,
        smooth_window=3,
    ),
    "plank": SpikeThresholdConfig(
        spike_threshold=2.5,
        min_steps=4,
        merge_gap=2,
        smooth_window=5,
    ),
}


def get_threshold_config(exercise: str | None) -> SpikeThresholdConfig:
    if exercise is None:
        return DEFAULT_THRESHOLD_CONFIG
    return EXERCISE_THRESHOLDS.get(exercise, DEFAULT_THRESHOLD_CONFIG)
