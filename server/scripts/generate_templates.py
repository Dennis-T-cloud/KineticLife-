#!/usr/bin/env python3
"""
Segment reps from training data and write clean DTW template JSON files.

Usage:
    python3 server/scripts/generate_templates.py          # write templates
    python3 server/scripts/generate_templates.py --dry-run  # print stats only
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT        = Path(__file__).resolve().parents[2]
DATA_DIR    = ROOT / "dtw_training_data"
TEMPLATE_DIR = ROOT / "server" / "data" / "templates"

JOINT_NAMES = (
    "left_knee", "right_knee", "left_elbow", "right_elbow",
    "left_hip",  "right_hip",  "left_shoulder", "right_shoulder",
    "left_ankle","right_ankle","left_wrist",  "right_wrist",
    "trunk_lean","pelvis_tilt",
)

# file prefix → (exercise_key, key_joint_indices_for_rep_detection, work=valley?)
# key joints: the joints whose average angle drives the rep state machine
# Note: 'work=valley' means angle DROPS during the work phase (squat/curl)
#       'work=valley=False' means angle RISES during work (lateral raise)
EXERCISE_MAP: dict[str, tuple[str, list[int], bool]] = {
    "sq":    ("squat",            [0, 1], True),   # knees valley at bottom
    "bsq":   ("barbell_squat",    [0, 1], True),
    "dl":    ("deadlift",         [4, 5], True),   # hips valley at hinge
    "lbi":   ("bicep_curl",       [3],    True),   # right_elbow valleys at curl peak
    "lib":   ("bicep_curl",       [3],    True),   # typo variant of lbi
    "rbi":   ("right_bicep_curl", [2],    True),   # left_elbow valleys at curl peak
    "lbrid": ("lateral_raise",    [6, 7], False),  # shoulders rise to peak
}

SMOOTH_WINDOW  = 7
MIN_REP_FRAMES = 25   # ~0.8 s at 30 fps — discard spurious short segments
MIN_PROMINENCE = 8.0  # degrees — min peak-to-valley swing to count as a real rep


# ---------------------------------------------------------------------------
# Signal utilities
# ---------------------------------------------------------------------------

def smooth(vals: list[float], window: int = SMOOTH_WINDOW) -> list[float]:
    radius = window // 2
    out: list[float] = []
    for i in range(len(vals)):
        start = max(0, i - radius)
        end   = min(len(vals), i + radius + 1)
        out.append(sum(vals[start:end]) / (end - start))
    return out


def find_peaks(signal: list[float], min_distance: int = 20) -> list[int]:
    """Return indices of local maxima with enforced minimum separation."""
    n = len(signal)
    candidates: list[int] = []
    for i in range(1, n - 1):
        if signal[i] >= signal[i - 1] and signal[i] >= signal[i + 1]:
            candidates.append(i)

    # Enforce min_distance: keep highest peak within each window
    peaks: list[int] = []
    for c in candidates:
        if not peaks or c - peaks[-1] >= min_distance:
            peaks.append(c)
        elif signal[c] > signal[peaks[-1]]:
            peaks[-1] = c
    return peaks


def key_signal(frames: list[dict], joints: list[int]) -> list[float]:
    return [
        sum(f["joint_angles"][j] or 0.0 for j in joints) / len(joints)
        for f in frames
    ]


# ---------------------------------------------------------------------------
# Rep segmentation
# ---------------------------------------------------------------------------

def segment_reps(
    frames: list[dict],
    joints: list[int],
    valley: bool,
) -> list[tuple[int, int]]:
    """
    Return (start, end) inclusive frame-index pairs, one per detected rep.

    Strategy: find peaks in the 'rest' signal (standing / arm-down position),
    then treat the interval between two consecutive rest peaks as one rep.
    For valley exercises this means finding maxima of the raw signal.
    For peak exercises (lateral raise) we invert the signal first.
    """
    raw   = key_signal(frames, joints)
    sig   = smooth(raw, SMOOTH_WINDOW)
    work_sig = [-v for v in sig] if not valley else sig

    # Find rest-position peaks (high angle for valley exercises)
    rest_peaks = find_peaks(work_sig, min_distance=MIN_REP_FRAMES)

    if len(rest_peaks) < 2:
        # Fallback: use full clip as one rep
        return [(0, len(frames) - 1)]

    reps: list[tuple[int, int]] = []
    for i in range(len(rest_peaks) - 1):
        start = rest_peaks[i]
        end   = rest_peaks[i + 1]
        if end - start < MIN_REP_FRAMES:
            continue
        # Check prominence: real excursion must exist between the two peaks
        segment = work_sig[start:end + 1]
        swing   = max(segment) - min(segment)
        if swing < MIN_PROMINENCE:
            continue
        reps.append((start, end))

    return reps if reps else [(0, len(frames) - 1)]


# ---------------------------------------------------------------------------
# Best-rep selection (median shape)
# ---------------------------------------------------------------------------

def resample_signal(sig: list[float], n: int = 50) -> list[float]:
    if len(sig) < 2:
        return [sig[0]] * n
    out: list[float] = []
    for i in range(n):
        t  = i * (len(sig) - 1) / (n - 1)
        lo = int(t)
        hi = min(lo + 1, len(sig) - 1)
        out.append(sig[lo] + (sig[hi] - sig[lo]) * (t - lo))
    return out


def select_best_rep(
    frames: list[dict],
    reps: list[tuple[int, int]],
    joints: list[int],
) -> tuple[int, int]:
    if len(reps) == 1:
        return reps[0]

    signals = [
        resample_signal(key_signal(frames[s:e + 1], joints))
        for s, e in reps
    ]
    n   = len(signals[0])
    med = [sum(sig[i] for sig in signals) / len(signals) for i in range(n)]

    best_i = min(
        range(len(signals)),
        key=lambda i: sum((signals[i][j] - med[j]) ** 2 for j in range(n)),
    )
    return reps[best_i]


# ---------------------------------------------------------------------------
# Template writing
# ---------------------------------------------------------------------------

def make_template(
    rep_frames: list[dict],
    exercise_key: str,
    source_file: str,
) -> dict:
    return {
        "template_id":          f"{exercise_key}_v1",
        "exercise":             exercise_key,
        "display_name":         exercise_key.replace("_", " ").title(),
        "joint_angles_version": 1,
        "source":               f"recorded_{source_file}",
        "frame_rate_hz":        30,
        "frames":               rep_frames,
    }


def holder_path(exercise_key: str) -> Path:
    return TEMPLATE_DIR / f"holder_{exercise_key}.json"


def template_path(exercise_key: str) -> Path:
    return TEMPLATE_DIR / f"{exercise_key}.json"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def resolve_prefix(filename: str) -> str | None:
    """Map a training filename to its prefix key."""
    stem = Path(filename).stem  # e.g. "bsq3" or "lib6"
    for prefix in sorted(EXERCISE_MAP, key=len, reverse=True):
        if stem.startswith(prefix):
            return prefix
    return None


def process_all(dry_run: bool = False) -> None:
    files = sorted(DATA_DIR.glob("*.json"))
    if not files:
        print(f"No JSON files found in {DATA_DIR}", file=sys.stderr)
        sys.exit(1)

    # Group files by exercise
    grouped: dict[str, list[Path]] = {}
    skipped: list[str] = []
    for f in files:
        prefix = resolve_prefix(f.name)
        if prefix is None:
            skipped.append(f.name)
            continue
        ex_key = EXERCISE_MAP[prefix][0]
        grouped.setdefault(ex_key, []).append(f)

    if skipped:
        print(f"Skipped (no mapping): {', '.join(skipped)}")

    # Per exercise: load all files, collect all reps, pick best
    for ex_key, ex_files in sorted(grouped.items()):
        exercise_key, joints, valley = next(
            v for p, v in EXERCISE_MAP.items()
            if v[0] == ex_key
        )

        all_reps: list[tuple[list[dict], int, int]] = []  # (frames, start, end)
        print(f"\n{'='*55}")
        print(f"Exercise: {ex_key}")

        for fpath in sorted(ex_files):
            raw_frames: list[dict] = json.loads(fpath.read_text())
            reps = segment_reps(raw_frames, joints, valley)
            sig  = smooth(key_signal(raw_frames, joints), SMOOTH_WINDOW)
            print(f"  {fpath.name:15s}  frames={len(raw_frames):4d}  "
                  f"reps_found={len(reps)}  "
                  f"key_range=[{min(sig):.0f}°, {max(sig):.0f}°]")
            for s, e in reps:
                all_reps.append((raw_frames, s, e))

        if not all_reps:
            print(f"  WARNING: no reps found for {ex_key}")
            continue

        # Select best single rep across all clips
        combined_frames: list[dict] = []
        combined_reps:   list[tuple[int, int]] = []
        offset = 0
        for frames, s, e in all_reps:
            combined_frames.extend(frames[s:e + 1])
            combined_reps.append((offset, offset + (e - s)))
            offset += e - s + 1

        best_s, best_e = select_best_rep(combined_frames, combined_reps, joints)
        best_frames = combined_frames[best_s:best_e + 1]

        # Re-index frame_id
        for i, f in enumerate(best_frames):
            f["frame_id"] = i
            f["ts_ms"]    = round(i * 1000 / 30)

        print(f"  → Best rep: {len(best_frames)} frames ({len(best_frames)/30:.1f}s)")

        # Source file attribution
        source_name = sorted(ex_files)[0].name

        if dry_run:
            print(f"  [DRY RUN] would write {template_path(ex_key)}")
            continue

        # Remove holder file if still present
        h = holder_path(ex_key)
        if h.exists():
            h.unlink()
            print(f"  Removed holder: {h.name}")

        tmpl = make_template(best_frames, ex_key, source_name)
        out  = template_path(ex_key)
        out.write_text(json.dumps(tmpl, indent=2))
        print(f"  Written: {out.name}")

    print("\nDone.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    process_all(dry_run=args.dry_run)
