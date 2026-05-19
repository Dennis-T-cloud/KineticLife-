from __future__ import annotations

from copy import deepcopy

from app.contracts import MockFrontendResponse

MOCK_SESSION_ID = "00000000-0000-4000-8000-000000000001"
MOCK_SERVER_TS_MS = 1745520000123


def available_mock_scenarios() -> list[str]:
    return sorted(_SCENARIOS)


def build_mock_frontend_response(scenario: str = "squat_knee_valgus") -> MockFrontendResponse:
    try:
        messages = deepcopy(_SCENARIOS[scenario])
    except KeyError as exc:
        raise KeyError(f"unknown mock scenario: {scenario}") from exc

    return MockFrontendResponse(
        scenario=scenario,
        session_id=MOCK_SESSION_ID,
        messages=messages,
    )


def _ack() -> dict:
    return {
        "v": 1,
        "type": "server.ack",
        "session_id": MOCK_SESSION_ID,
        "server_ts_ms": MOCK_SERVER_TS_MS,
        "server_version": "0.3.0",
        "negotiated_v": 1,
        "templates_available": ["squat", "curl"],
    }


def _set_event(event: str, *, rep_index: int | None = None, summary: dict | None = None) -> dict:
    message = {
        "v": 1,
        "type": "server.set_event",
        "session_id": MOCK_SESSION_ID,
        "ts_ms": MOCK_SERVER_TS_MS + 1000,
        "event": event,
        "set_index": 1,
    }
    if rep_index is not None:
        message["rep_index"] = rep_index
    if summary is not None:
        message["summary"] = summary
    return message


def _feedback(
    *,
    for_frame_id: int,
    correct: bool,
    classified_as: str,
    confidence: float,
    problem_joints: list[dict],
    completeness: float,
    dtw_distance: float,
    threshold: float,
    template_id: str,
) -> dict:
    return {
        "v": 1,
        "type": "server.feedback",
        "session_id": MOCK_SESSION_ID,
        "for_frame_id": for_frame_id,
        "server_ts_ms": MOCK_SERVER_TS_MS + 1200,
        "correct": correct,
        "classified_as": classified_as,
        "classifier_confidence": confidence,
        "problem_joints": problem_joints,
        "completeness": completeness,
        "dtw_distance": dtw_distance,
        "dtw_threshold": threshold,
        "reference_template_id": template_id,
    }


def _advice(markdown: str, *, scope: str = "set_end") -> dict:
    return {
        "v": 1,
        "type": "server.advice_tip",
        "session_id": MOCK_SESSION_ID,
        "scope": scope,
        "markdown": markdown,
        "generated_at_ms": MOCK_SERVER_TS_MS + 2500,
        "model": "local-heuristic",
    }


_SCENARIOS = {
    "squat_good": [
        _ack(),
        _set_event("set_start"),
        _feedback(
            for_frame_id=24,
            correct=True,
            classified_as="squat",
            confidence=0.96,
            problem_joints=[],
            completeness=0.92,
            dtw_distance=1.34,
            threshold=2.1,
            template_id="perfect_squat_v1",
        ),
        _set_event("rep_detected", rep_index=1),
        _set_event(
            "set_end",
            summary={
                "rep_count": 1,
                "correct_count": 1,
                "avg_completeness": 0.92,
                "duration_s": 4.2,
            },
        ),
        _advice("Strong rep. Your squat stayed close to the reference through the full range."),
    ],
    "squat_knee_valgus": [
        _ack(),
        _set_event("set_start"),
        _feedback(
            for_frame_id=28,
            correct=False,
            classified_as="squat",
            confidence=0.91,
            problem_joints=[
                {"joint": "left_knee", "severity": 0.74, "issue": "valgus"},
                {"joint": "right_knee", "severity": 0.66, "issue": "valgus"},
            ],
            completeness=0.78,
            dtw_distance=3.42,
            threshold=2.1,
            template_id="perfect_squat_v1",
        ),
        _set_event("rep_detected", rep_index=1),
        _advice("Your knees drifted inward near the bottom. Keep them tracking over your feet."),
    ],
    "curl_elbow_drift": [
        _ack(),
        _set_event("set_start"),
        _feedback(
            for_frame_id=18,
            correct=False,
            classified_as="curl",
            confidence=0.88,
            problem_joints=[
                {"joint": "left_elbow", "severity": 0.58, "issue": "asymmetric"},
                {"joint": "left_shoulder", "severity": 0.42, "issue": "asymmetric"},
            ],
            completeness=0.81,
            dtw_distance=2.95,
            threshold=1.9,
            template_id="perfect_curl_v1",
        ),
        _set_event("rep_detected", rep_index=1),
        _advice("Your left arm drifted away from the reference. Keep the elbow path tighter."),
    ],
}
