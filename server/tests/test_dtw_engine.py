from __future__ import annotations

import unittest

from app.ml.dtw_engine import (
    AlignmentPair,
    AngleFrame,
    compute_aligned_errors,
    compute_dtw_alignment_path,
    detect_error_spikes,
)
from app.ml.preprocessing import preprocess_frames


def frame(index: int, angles: list[float | None]) -> AngleFrame:
    return AngleFrame(frame_id=index, ts_ms=index * 100, joint_angles=angles)


def angles(value: float) -> list[float]:
    return [value] * 14


def angles_with(value: float, overrides: dict[int, float | None]) -> list[float | None]:
    out: list[float | None] = [value] * 14
    for index, override in overrides.items():
        out[index] = override
    return out


class DtwEngineTests(unittest.TestCase):
    def test_compute_dtw_alignment_path_handles_different_rep_timing(self) -> None:
        user = [
            frame(0, angles(170)),
            frame(1, angles(150)),
            frame(2, angles(130)),
            frame(3, angles(130)),
            frame(4, angles(150)),
            frame(5, angles(170)),
        ]
        template = [
            frame(0, angles(170)),
            frame(1, angles(130)),
            frame(2, angles(170)),
        ]

        path = compute_dtw_alignment_path(user, template)

        self.assertEqual(path[0], AlignmentPair(user_index=0, template_index=0))
        self.assertEqual(path[-1], AlignmentPair(user_index=5, template_index=2))
        self.assertGreaterEqual(len(path), len(user))

    def test_compute_aligned_errors_reports_per_joint_error(self) -> None:
        user = [frame(10, [170, 160, *angles(100)[:12]])]
        template = [frame(20, [165, None, *angles(100)[:12]])]

        errors = compute_aligned_errors(user, template, [AlignmentPair(0, 0)])

        self.assertEqual(errors[0].per_joint_error["left_knee"], 5)
        self.assertIsNone(errors[0].per_joint_error["right_knee"])
        self.assertEqual(errors[0].total_error, 5 / 13)

    def test_detect_error_spikes_finds_sustained_joint_spike(self) -> None:
        template = [frame(i, angles(100)) for i in range(8)]
        user = [frame(i, angles(100)) for i in range(8)]
        for index in (3, 4, 5):
            changed = angles(100)
            changed[12] = 140
            user[index] = frame(index, changed)

        aligned = compute_aligned_errors(
            user,
            template,
            [AlignmentPair(i, i) for i in range(8)],
        )
        spikes = detect_error_spikes(aligned, threshold=2, min_steps=2, smooth_window=1)

        self.assertEqual(len(spikes), 1)
        self.assertEqual(spikes[0].dominant_joint, "trunk_lean")
        self.assertEqual(spikes[0].start_step, 3)
        self.assertEqual(spikes[0].end_step, 5)


class DtwEngineGuardrailTests(unittest.TestCase):
    def test_compute_dtw_alignment_path_rejects_empty_user_frames(self) -> None:
        with self.assertRaises(ValueError):
            compute_dtw_alignment_path([], [frame(0, angles(100))])

    def test_compute_dtw_alignment_path_rejects_all_none_frames(self) -> None:
        broken = [frame(i, [None] * 14) for i in range(3)]
        with self.assertRaises(ValueError):
            compute_dtw_alignment_path(broken, [frame(0, angles(100))])

    def test_compute_dtw_alignment_path_rejects_wrong_joint_count(self) -> None:
        bad = [AngleFrame(frame_id=0, ts_ms=0, joint_angles=[100.0] * 10)]
        with self.assertRaises(ValueError):
            compute_dtw_alignment_path(bad, [frame(0, angles(100))])

    def test_compute_dtw_alignment_path_rejects_negative_band_width(self) -> None:
        user = [frame(i, angles(100)) for i in range(3)]
        template = [frame(i, angles(100)) for i in range(3)]
        with self.assertRaises(ValueError):
            compute_dtw_alignment_path(user, template, band_width=-1)


class DtwEngineBandTests(unittest.TestCase):
    def test_band_widens_when_smaller_than_length_difference(self) -> None:
        user = [frame(i, angles(100)) for i in range(20)]
        template = [frame(i, angles(100)) for i in range(5)]
        path = compute_dtw_alignment_path(user, template, band_width=1)
        self.assertEqual(path[0], AlignmentPair(0, 0))
        self.assertEqual(path[-1], AlignmentPair(19, 4))

    def test_band_zero_is_unbanded(self) -> None:
        user = [frame(i, angles(100 + i)) for i in range(6)]
        template = [frame(i, angles(100 + i)) for i in range(6)]
        banded = compute_dtw_alignment_path(user, template, band_width=1)
        unbanded = compute_dtw_alignment_path(user, template, band_width=0)
        self.assertEqual(banded[0], unbanded[0])
        self.assertEqual(banded[-1], unbanded[-1])


class PreprocessingTests(unittest.TestCase):
    def test_preprocess_frames_fills_interior_none_via_linear_interp(self) -> None:
        frames = [
            frame(0, angles_with(100, {0: 100.0})),
            frame(1, angles_with(100, {0: None})),
            frame(2, angles_with(100, {0: 120.0})),
        ]
        processed = preprocess_frames(frames, smooth_window=1)
        self.assertAlmostEqual(processed[1].joint_angles[0], 110.0)

    def test_preprocess_frames_extends_leading_and_trailing_nones(self) -> None:
        frames = [
            frame(0, angles_with(100, {0: None})),
            frame(1, angles_with(100, {0: 80.0})),
            frame(2, angles_with(100, {0: None})),
        ]
        processed = preprocess_frames(frames, smooth_window=1)
        self.assertEqual(processed[0].joint_angles[0], 80.0)
        self.assertEqual(processed[2].joint_angles[0], 80.0)

    def test_preprocess_frames_leaves_fully_missing_joint_as_none(self) -> None:
        frames = [frame(i, angles_with(100, {0: None})) for i in range(3)]
        processed = preprocess_frames(frames, smooth_window=1)
        for processed_frame in processed:
            self.assertIsNone(processed_frame.joint_angles[0])

    def test_preprocess_frames_smooths_a_single_spike(self) -> None:
        frames = [
            frame(0, angles_with(100, {0: 100.0})),
            frame(1, angles_with(100, {0: 100.0})),
            frame(2, angles_with(100, {0: 200.0})),
            frame(3, angles_with(100, {0: 100.0})),
            frame(4, angles_with(100, {0: 100.0})),
        ]
        processed = preprocess_frames(frames, smooth_window=3)
        self.assertLess(processed[2].joint_angles[0], 200.0)
        self.assertGreater(processed[2].joint_angles[0], 100.0)


if __name__ == "__main__":
    unittest.main()
