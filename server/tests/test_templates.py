import json
import tempfile
import unittest
from pathlib import Path

from app.ml.dtw_engine import JOINT_COUNT
from app.ml.templates import get_template_by_exercise, load_templates


class TemplateTests(unittest.TestCase):
    def test_baseline_templates_load(self) -> None:
        templates = load_templates()
        exercises = {template.exercise for template in templates}

        self.assertIn("squat", exercises)
        self.assertIn("curl", exercises)
        self.assertEqual(len({template.template_id for template in templates}), len(templates))

    def test_each_baseline_frame_has_14_joint_angles(self) -> None:
        for template in load_templates():
            self.assertEqual(template.joint_angles_version, 1)
            self.assertGreater(len(template.frames), 0)
            for frame in template.frames:
                self.assertEqual(len(frame.joint_angles), JOINT_COUNT)

    def test_get_template_by_exercise_returns_matching_template(self) -> None:
        template = get_template_by_exercise("squat")

        self.assertEqual(template.exercise, "squat")
        self.assertEqual(template.template_id, "perfect_squat_v1")

    def test_load_templates_rejects_duplicate_template_ids(self) -> None:
        template_payload = {
            "template_id": "duplicate_v1",
            "exercise": "squat",
            "display_name": "Duplicate",
            "joint_angles_version": 1,
            "source": "test",
            "frame_rate_hz": 10,
            "frames": [
                {
                    "frame_id": 0,
                    "ts_ms": 0,
                    "joint_angles": [100] * JOINT_COUNT,
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmp:
            template_dir = Path(tmp)
            (template_dir / "one.json").write_text(json.dumps(template_payload), encoding="utf-8")
            (template_dir / "two.json").write_text(json.dumps(template_payload), encoding="utf-8")

            with self.assertRaises(ValueError):
                load_templates(template_dir)


if __name__ == "__main__":
    unittest.main()
