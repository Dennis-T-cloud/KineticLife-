from __future__ import annotations

from app.ml.dtw_engine import ErrorSpike

MAX_COACHING_TIPS = 2

JOINT_LABELS = {
    "left_knee": "left knee",
    "right_knee": "right knee",
    "left_elbow": "left elbow",
    "right_elbow": "right elbow",
    "left_hip": "left hip",
    "right_hip": "right hip",
    "left_shoulder": "left shoulder",
    "right_shoulder": "right shoulder",
    "left_ankle": "left ankle",
    "right_ankle": "right ankle",
    "left_wrist": "left wrist",
    "right_wrist": "right wrist",
    "trunk_lean": "torso angle",
    "pelvis_tilt": "hip alignment",
}

JOINT_ACTIONS = {
    "left_knee": "keep that knee tracking steadily over your foot",
    "right_knee": "keep that knee tracking steadily over your foot",
    "left_elbow": "keep the elbow path controlled",
    "right_elbow": "keep the elbow path controlled",
    "left_hip": "match the target hip depth more closely",
    "right_hip": "match the target hip depth more closely",
    "left_shoulder": "keep the shoulder path closer to the reference",
    "right_shoulder": "keep the shoulder path closer to the reference",
    "left_ankle": "keep the foot and ankle position more stable",
    "right_ankle": "keep the foot and ankle position more stable",
    "left_wrist": "keep the wrist path controlled",
    "right_wrist": "keep the wrist path controlled",
    "trunk_lean": "keep your chest a little more controlled",
    "pelvis_tilt": "keep your hips level through the movement",
}


def generate_coaching_text(
    spikes: list[ErrorSpike],
    *,
    exercise: str | None = None,
    max_tips: int = MAX_COACHING_TIPS,
) -> list[str]:
    """Turn DTW error spikes into short, local heuristic coaching tips."""
    if max_tips <= 0:
        return []
    if not spikes:
        return [_fallback_tip(exercise)]

    tips: list[str] = []
    seen_joints: set[str] = set()
    for spike in sorted(spikes, key=lambda item: item.peak_error, reverse=True):
        if spike.dominant_joint in seen_joints:
            continue
        seen_joints.add(spike.dominant_joint)
        tips.append(_tip_for_spike(spike, exercise))
        if len(tips) >= max_tips:
            break

    return tips or [_fallback_tip(exercise)]


def _tip_for_spike(spike: ErrorSpike, exercise: str | None) -> str:
    joint_label = JOINT_LABELS.get(spike.dominant_joint, spike.dominant_joint.replace("_", " "))
    action = JOINT_ACTIONS.get(spike.dominant_joint, "move closer to the reference pattern")
    severity = _severity_label(spike.dominant_joint_error)
    prefix = f"During the {exercise}, " if exercise else ""
    return (
        f"{prefix}{spike.phase}, your {joint_label} drifted {severity} "
        f"from the template; {action}."
    )


def _severity_label(error_degrees: float) -> str:
    if error_degrees >= 30:
        return "a lot"
    if error_degrees >= 18:
        return "noticeably"
    return "slightly"


def _fallback_tip(exercise: str | None) -> str:
    if exercise:
        return f"Your {exercise} stayed close to the reference; keep the same tempo and control."
    return "Your movement stayed close to the reference; keep the same tempo and control."
