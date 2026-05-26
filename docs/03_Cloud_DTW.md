# 03 - Cloud / FastAPI DTW

> Last updated: 2026-05-26
> Scope: current `server/` implementation

The server is a summary-time analysis service. It does not participate in live rep counting or live form feedback.

---

## Current State

Implemented now:

- FastAPI app in `server/app/main.py`
- template loading from `server/data/templates/*.json`
- multi-template classification by normalized DTW distance
- DTW alignment path and per-joint aligned errors
- error spike detection with exercise-specific thresholds
- in-memory compressed action history
- helper service for coaching analysis and text tips
- tests for DTW, templates, thresholds, advice rules, and template variance scripts

Not implemented in current code:

- Postgres persistence
- Redis/cache layer
- JWT auth
- public advice route
- `dtaidistance` dependency
- background workers

The DTW engine is custom Python with optional NumPy acceleration, not `dtaidistance`.

---

## Project Layout

```text
server/
├── app/
│   ├── main.py
│   ├── contracts.py
│   ├── ml/
│   │   ├── dtw_engine.py
│   │   ├── preprocessing.py
│   │   ├── templates.py
│   │   └── thresholds.py
│   └── advice/
│       ├── rules.py
│       └── service.py
├── data/templates/
│   ├── squat.json
│   ├── barbell_squat.json
│   ├── deadlift.json
│   ├── bicep_curl.json
│   ├── right_bicep_curl.json
│   └── lateral_raise.json
├── scripts/
└── tests/
```

---

## Setup

```bash
cd server
uv sync
uv run uvicorn app.main:app --reload
uv run pytest
```

`pyproject.toml` currently declares:

- Python >= 3.12
- FastAPI
- Uvicorn
- Pydantic

NumPy is optional in `dtw_engine.py`; the engine has a pure-Python fallback.

---

## API Routes

### `GET /health`

Returns:

```json
{"ok": true}
```

### `GET /api/templates`

Returns key-angle signals for loaded templates:

```json
{
  "squat": [154.2, 152.1],
  "bicep_curl": [160.0, 148.0]
}
```

Signals are raw template-frame values. The browser can resample them for charts.

### `POST /api/actions`

Input is a completed action sequence:

```json
{
  "v": 1,
  "type": "client.action_submit",
  "session_id": "uuid-or-demo-id",
  "action_id": "act-...",
  "exercise_hint": "squat",
  "ts_start_ms": 1745520010000,
  "ts_end_ms": 1745520012500,
  "frames": [
    {
      "frame_id": 0,
      "ts_ms": 1745520010000,
      "joint_angles": [153.6, 151.2, 141.0, 152.0, 162.6, 161.7, 15.6, 14.1, 106.8, 107.9, 150.1, 155.5, 11.2, 1.3]
    }
  ]
}
```

Response:

```json
{
  "action_id": "act-...",
  "exercise": "squat",
  "correct": true,
  "dtw_distance": 1.2345,
  "completeness": 0.87,
  "problem_joints": [],
  "processed_at": "2026-05-26T..."
}
```

### `GET /api/history/{action_id}`

Returns the in-memory record created by `/api/actions`. Data is lost when the server process restarts.

---

## DTW Pipeline

```text
ActionSubmit frames
  -> AngleFrame list
  -> preprocess_frames()
  -> score against every loaded template
  -> choose best template
  -> compute_dtw_alignment_path()
  -> compute_aligned_errors()
  -> detect_error_spikes()
  -> ActionResponse
  -> gzip original submitted frames into _actions[action_id]
```

`compute_dtw_alignment_path()` uses:

- 14-D angle frames
- absolute per-joint difference
- mean of valid joints
- Sakoe-Chiba band by default
- optional NumPy vectorization for local distance matrix setup

`detect_error_spikes()` uses:

- moving average smoothing
- threshold from `thresholds.py`
- minimum spike length
- merge gap
- dominant-joint aggregation
- phase label: early, middle, or near end

---

## Templates

Template schema:

```json
{
  "template_id": "squat_v1",
  "exercise": "squat",
  "display_name": "Squat",
  "joint_angles_version": 1,
  "source": "recorded_sq1.json",
  "frame_rate_hz": 30,
  "frames": [
    {
      "frame_id": 0,
      "ts_ms": 0,
      "joint_angles": [153.6, 151.2, 141.0, 152.0, 162.6, 161.7, 15.6, 14.1, 106.8, 107.9, 150.1, 155.5, 11.2, 1.3]
    }
  ]
}
```

`templates.py` skips holder templates and validates:

- required metadata fields
- non-empty frames
- exactly 14 joint-angle values per frame
- unique `template_id`

---

## Advice Helpers

`app/advice/service.py` can analyze a `CoachingAnalysisRequest` and return:

- tips
- alignment path
- aligned per-step errors
- detected spikes

This helper is tested but not registered as an HTTP route in `main.py`.

---

## Current Persistence

`main.py` stores actions in process memory:

```python
_actions: dict[str, dict] = {}
```

Frames are gzip-compressed JSON under `frames_compressed`.

This is sufficient for local/demo behavior but not durable. A production persistence layer would need a contract update if response semantics or privacy rules change.

---

## Verification

```bash
cd server
uv run pytest
uv run uvicorn app.main:app --reload
```

Manual smoke test:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/templates
```
