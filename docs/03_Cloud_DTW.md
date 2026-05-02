# 03 · Cloud + DTW + Classifier

> **Version**: v0.3
> **Audience**: Backend + algorithm engineer
> **Contracts**: For external data formats, MUST read [`04_Interface_Contracts.md`](./04_Interface_Contracts.md)

---

## §1 Scope & External Commitments

| You own | You don't own |
|-----------|-------------|
| FastAPI + WebSocket service | ESP32 / browser side |
| **DTW engine** (14 angles + dtaidistance) | MediaPipe integration |
| Pluggable classifier interface (SVM first, swappable for CNN) | Frontend UI |
| Server-side validation of auto-set detection | Gesture detection |
| Async coaching advice (3 trigger points) | Advice UI |
| Postgres + Redis data layer | |
| Honoring [04 §3 / §4](./04_Interface_Contracts.md) WebSocket protocol | |

**External commitments**:
- Main path (`client.keypoints` → `server.feedback`) P95 ≤ 250 ms (leaving budget for the 400 ms end-to-end)
- DTW engine and frontend's 14-angle formula must **strictly match** (shared fixture tests)
- Coaching advice is entirely async; **never blocks the main path**

---

## §2 Tech Stack

| Layer | Choice | Notes |
|---|------|------|
| Runtime | Python 3.12 | |
| Web framework | **FastAPI** + Uvicorn | Native WS + REST |
| Database | **Neon Postgres** | Free tier sufficient for demo |
| Cache / session | **Upstash Redis** | Free tier |
| Deploy | **Fly.io** | scale-to-zero, WS-friendly |
| DTW | **`dtaidistance`** | C-impl, very fast |
| ML | `scikit-learn` (SVM) + `numpy` + `scipy.signal` (peaks) | |
| Advice generation | Low-cost text generation provider | Swappable behind `AdviceProvider` |
| Serialization | Pydantic v2 | Maps directly to contracts §3/§4 |
| Tests | pytest + pytest-asyncio | |

**Project layout**:
```
server/
├── pyproject.toml
├── fly.toml
├── app/
│   ├── main.py             # FastAPI entry
│   ├── ws.py               # WebSocket handler
│   ├── contracts.py        # Pydantic models (translated from 04)
│   ├── ml/
│   │   ├── dtw_engine.py   # DTW main engine
│   │   ├── joint_angles.py # 14 angles (shared fixtures with frontend)
│   │   ├── classifier.py   # ActionClassifier Protocol + SVM impl
│   │   ├── set_detector.py # Auto-set (server validation)
│   │   └── templates.py    # Template loading + Procrustes
│   ├── advice/
│   │   ├── rules.py        # Advice copy rules
│   │   └── client.py       # Provider wrapper
│   ├── db/
│   │   ├── models.py       # SQLAlchemy
│   │   └── migrations/     # Alembic
│   ├── auth.py             # JWT
│   └── config.py
├── scripts/
│   ├── record_template.py  # Standard action recording (W2)
│   ├── train_svm.py        # Train SVM (W4)
│   └── eval_dtw.py         # DTW threshold calibration
├── tests/
│   ├── fixtures/
│   │   └── joint_angles_v1.json  # ← shared with frontend
│   ├── test_joint_angles.py
│   ├── test_dtw.py
│   └── test_ws_protocol.py
└── data/
    └── templates/          # Standard action JSON
```

---

## §3 API Gateway (FastAPI + WS)

**Single-process monolith** (no need to split for <100 users).

```python
# app/main.py
from fastapi import FastAPI, WebSocket
from app.ws import handle_ws

app = FastAPI(title="KineticLife API", version="0.3.0")

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await handle_ws(ws)

@app.get("/health")
async def health():
    return {"ok": True}
```

**WS handler** (`app/ws.py`):

```python
async def handle_ws(ws: WebSocket):
    await ws.accept(subprotocol="kineticlife.v1")

    # 1. First message MUST be client.hello
    hello = ClientHello.model_validate_json(await ws.receive_text())
    if hello.client_capabilities.joint_angles_version != 1:
        await ws.close(code=4001)  # version mismatch
        return

    session = await create_session(hello)
    await ws.send_json(ServerAck(...).model_dump())

    # 2. Main loop
    async for msg in ws.iter_text():
        envelope = parse_envelope(msg)
        match envelope.type:
            case "client.keypoints":
                await handle_keypoints(session, envelope, ws)
            case "client.gesture":
                await handle_gesture(session, envelope, ws)
            case "client.action_submit":
                await handle_action_submit(session, envelope, ws)
            # ...
```

**Pydantic models** (`app/contracts.py`) translated 1-to-1 from contracts §3/§4. Frontend and backend can **share schemas** (`pydantic2ts` to auto-generate TS).

---

## §4 DTW Engine

### Full recognition pipeline

```text
client.keypoints (10–15 Hz, continuous)
  │
  ▼
ActionClassifier (rolling 2 s window, every 500 ms)
  │  3 consecutive same label + confidence > 0.85 → lock action type
  ▼
SetDetector.feed() — tracks indicator curve (e.g. hip angle for squat)
  │  peak/valley detection → rep boundary found
  ▼
Segmented rep  [T_start, T_end] × joint_angles[T, 14]
  │  discard if T < 0.5 s or T > 5 s (noise gate)
  ▼
DTW preprocessing: NaN interpolation → Savitzky-Golay smooth → downsample to 30 frames
  │
  ▼
dtw_ndim.distance(user_rep, template) → dtw_distance
dtw_ndim.warping_path(...)           → alignment path
  │
  ▼
find_problem_joints() — per-joint deviation along alignment path
  │  top-2 joints above threshold → problem_joints[]
  ▼
server.feedback {correct, completeness, dtw_distance, problem_joints}
  + server.set_event {rep_detected, rep_index}
```

Key implication: DTW only runs on cleanly segmented reps — **never on the raw continuous stream**. The segmenter is the noise gate; it makes DTW robust to partial / transitional poses between reps.

**Input**: `joint_angles[T, 14]` series (per contract §5, **formula identical to frontend**)

**Preprocessing** (`ml/dtw_engine.py`):
1. **NaN interpolation** (per contract, low-confidence frames are null/NaN) → linear interp
2. **Smoothing**: `scipy.signal.savgol_filter`, window=5, poly=2
3. **Downsample**: unify to 30 frames (faster DTW)

**DTW computation**:

```python
import numpy as np
from dtaidistance import dtw_ndim

def dtw_distance(user: np.ndarray, template: np.ndarray) -> float:
    """user: [T1, 14], template: [T2, 14], returns distance"""
    return dtw_ndim.distance(user, template)

def dtw_path(user, template):
    """Alignment path, used to localize problem joints"""
    return dtw_ndim.warping_path(user, template)
```

**Problem joint localization** (key algorithm):

```python
def find_problem_joints(user, template, joint_names) -> list[ProblemJoint]:
    path = dtw_ndim.warping_path(user, template)
    # Sum per-joint deviation along the alignment path
    deviations = np.zeros(14)
    for i_u, i_t in path:
        deviations += np.abs(user[i_u] - template[i_t])

    # Top-2 highest deviations = problem joints
    top_idx = np.argsort(deviations)[-2:][::-1]
    return [
        ProblemJoint(
            joint=joint_names[i],
            severity=min(1.0, deviations[i] / NORM_FACTOR[joint_names[i]]),
            issue=infer_issue(joint_names[i], user, template, path)
        )
        for i in top_idx if deviations[i] > THRESHOLD[joint_names[i]]
    ]
```

**`infer_issue` heuristics** (simplified — sufficient for demo):
- Knee + angle smaller than template + negative hip-abduction → `valgus`
- Hip + angle larger than template + completeness < 0.7 → `insufficient_depth`
- Trunk lean + larger than template → `excessive_lean`

**Threshold calibration** (W3 task):
- Record 20 "correct" + 20 "incorrect" labeled sets
- Threshold = 95th percentile of correct set's DTW distances
- Per-action threshold, stored in `templates` table

**Performance**: 30 frames × 14 dims, dtaidistance C impl, < 5 ms.

---

## §5 Pluggable Classifier Interface

**Why pluggable**: SVM is the MVP starter. Once data scales, swap to 1D-CNN / ST-GCN / Transformer **without touching anything else**.

**Interface definition** (`ml/classifier.py`):

```python
from typing import Protocol
import numpy as np
from dataclasses import dataclass

@dataclass
class ClassifyResult:
    label: str              # "squat" | "pushup" | "plank" | "unknown"
    confidence: float       # 0.0–1.0
    top_k: list[tuple[str, float]]
    reject_reason: str | None  # "low_visibility" | "too_short" | None

class ActionClassifier(Protocol):
    def classify(
        self,
        joint_angles: np.ndarray,    # [T, 14]
        context: dict | None = None  # e.g. {"action_hint": "squat"}
    ) -> ClassifyResult: ...

    @property
    def labels(self) -> list[str]: ...
```

**Initial implementation: SVM** (`ml/classifier.py`):

```python
class SvmClassifier:
    def __init__(self, model_path: str):
        self.model = joblib.load(model_path)
        self._labels = self.model.classes_.tolist() + ["unknown"]

    def classify(self, joint_angles, context=None):
        if joint_angles.shape[0] < 10:
            return ClassifyResult("unknown", 0.0, [], "too_short")

        feats = self._extract_features(joint_angles)  # ~30 dims
        probs = self.model.predict_proba([feats])[0]
        top_k = sorted(zip(self.model.classes_, probs), key=lambda x: -x[1])[:3]

        if context and (hint := context.get("action_hint")):
            # Duolingo: user has chosen, lower rejection threshold
            if hint in dict(top_k) and dict(top_k)[hint] > 0.5:
                return ClassifyResult(hint, dict(top_k)[hint], top_k, None)

        if top_k[0][1] < 0.6:
            return ClassifyResult("unknown", top_k[0][1], top_k, "low_confidence")
        return ClassifyResult(top_k[0][0], top_k[0][1], top_k, None)

    def _extract_features(self, ja: np.ndarray) -> np.ndarray:
        # Per-angle mean/std/min/max + duration + dominant motion direction
        feats = np.concatenate([
            ja.mean(axis=0), ja.std(axis=0), ja.min(axis=0), ja.max(axis=0),
            [ja.shape[0], np.argmax(np.abs(np.diff(ja, axis=0)).sum(axis=0))]
        ])
        return feats
```

**Upgrade path (placeholders)**:
1. **1D-CNN** (data >2000 samples): swap implementation; interface unchanged
2. **ST-GCN**: needs 33 keypoints, not just 14 angles — add field to `ClassifyResult` context
3. **Transformer**: long-term

**Jump-in rolling classification** (W4):
- Server runs every 500 ms over the last 2 s window
- 3 consecutive same-label + confidence > 0.85 → lock action type
- DTW then queries only that action's templates

---

## §6 Server-side Set Detection (Validation)

**Contract**: Client shows optimistic UI; **server is authoritative** via `server.set_event`.

**Algorithm** (`ml/set_detector.py`):

```python
from scipy.signal import find_peaks

class SetDetector:
    def __init__(self, action: str):
        self.action = action
        self.indicator_buffer = []  # rolling 30s
        self.rep_count = 0
        self.state = "IDLE"  # IDLE / READY / REPPING / RESTING / ENDED

    def feed(self, ts_ms: int, joint_angles: np.ndarray):
        indicator = self._extract_indicator(joint_angles)
        self.indicator_buffer.append((ts_ms, indicator))
        self._gc()  # drop entries older than 30s

        match self.state:
            case "IDLE": self._maybe_start()
            case "REPPING": self._detect_rep_and_rest()
            case "RESTING": self._detect_resume_ord()

    def _extract_indicator(self, ja):
        if self.action == "squat":
            return -ja[..., MID_HIP_Y_PROXY]  # use hip angle as proxy
        if self.action == "pushup":
            return ja[..., LEFT_ELBOW_IDX]
        # ...

    def _detect_rep_and_rest(self):
        ts, ind = zip(*self.indicator_buffer[-100:])
        peaks, _ = find_peaks(ind, distance=10, prominence=0.1)
        new_reps = len(peaks) - self.rep_count
        if new_reps > 0:
            self.rep_count = len(peaks)
            self.emit("rep_detected", rep_index=self.rep_count)

        # 3 s no new peak → enter RESTING
        last_motion = max(ind[-30:]) - min(ind[-30:])
        if last_motion < 0.05:
            self.state = "RESTING"
            self.emit("rest_started")
```

**DTW double-check**: For each detected rep, run DTW on that period; if distance > threshold × 3, reject as a false positive (user might be moving but not doing this exercise) — **do not count**.

---

## §7 Async Coaching Advice (Off Main Path)

**Contract**: [`server.advice_tip`](./04_Interface_Contracts.md#44-serveradvice_tip--async-coaching-advice-off-main-path)

**Triggers**:

| Trigger | Timing | User-perceived latency |
|-----|------|-------------|
| `login` | After WS connect, while user is browsing courses | 3–5 s, prefetched in background |
| `set_end` | After `set_end` event | 1–2 s, can stream |
| `day_end` | When user opens "today's summary" | 2–4 s |
| `consecutive_fail` | 3× same problem joint in a row | Shows on click-to-expand |

**Implementation** (`advice/client.py`):

```python
provider = AdviceProvider(api_key=...)

async def generate_tip(scope: str, ctx: dict) -> str:
    cache_key = make_cache_key(scope, ctx)
    if cached := await redis.get(cache_key):
        return cached

    text = await provider.generate(scope=scope, context=ctx, max_words=40)
    await redis.set(cache_key, text, ex=3600)
    return text
```

**Advice copy rules** (`advice/rules.py`):
- 1-2 sentences, no more than 40 words
- Specific and actionable; reference the detected joint or range-of-motion issue
- No generic platitudes, medical diagnoses, or professional-care claims

**Cost control**:
- Low-cost provider tier
- Login summary cached 24 h
- Per-user daily cap: 10 calls; over the cap, fall back to local templates
- 100 users × 10 calls × $0.0004 ≈ $12/month

---

## §8 Database Schema

**Contract layer**: [04 §8](./04_Interface_Contracts.md#8-database-schema-contract-server-internal-but-client-needs-to-know)

**Actual tables** (SQLAlchemy):

```python
class Session(Base):
    __tablename__ = "sessions"
    session_id: Mapped[UUID] = mapped_column(primary_key=True)
    user_id: Mapped[UUID | None]
    mode: Mapped[str]  # jumpin / duolingo / demo
    started_at: Mapped[datetime]
    ended_at: Mapped[datetime | None]

class Action(Base):
    __tablename__ = "actions"
    action_id: Mapped[str] = mapped_column(primary_key=True)
    session_id: Mapped[UUID]
    exercise: Mapped[str]
    correct: Mapped[bool]
    dtw_distance: Mapped[float]
    completeness: Mapped[float]
    problem_joints: Mapped[list[dict]] = mapped_column(JSONB)
    joint_angles_compressed: Mapped[bytes]           # gzip(joint_angles[T,14])
    world_landmarks_compressed: Mapped[bytes | None]  # gzip(world_landmarks[T,33,4]); null unless replay opt-in
    created_at: Mapped[datetime]

class Template(Base):
    __tablename__ = "templates"
    template_id: Mapped[str] = mapped_column(primary_key=True)
    exercise: Mapped[str]
    view_angle: Mapped[int]  # placeholder; demo all 0°
    joint_angles: Mapped[bytes]  # 14-angle series for the standard
    dtw_threshold: Mapped[float]
    created_at: Mapped[datetime]

class GestureEvent(Base):
    # ...
class AiTip(Base):
    # ...
```

**Privacy contract (HARD RULE)**:
- **Never** store `world_landmarks` x/y/z absolutes or `image_landmarks`
- Only store 14-D `joint_angles` (already view-invariant + de-identified)
- Derived labels OK (correct, problem_joints, completeness)

---

## §9 Standard Template Recording (W2 task)

`scripts/record_template.py`:
- Have the model do the standard action 5 times
- Each pass goes through the full MediaPipe + 14-angle pipeline
- Take the DTW average of 5 passes (the "prototype") as the template
- Insert into `templates` table

**Demo scope**: 3 actions × 1 view angle (0°) = 3 templates total.

**Future-proofing**: `view_angle` column is reserved — adding 30°/45° templates **does not require schema changes**.

---

## §10 Security & Observability

| Item | Implementation |
|---|------|
| Auth | Short-lived JWT (after login), validated on first WS frame |
| Rate limiting | Per-session `client.keypoints` ≤ 30 Hz; over → `server.error.rate_limit` |
| Logs | structlog → stdout → Fly.io logs |
| Monitoring | Grafana Cloud free tier (P95 latency / error rate) + Sentry frontend |
| Data sanitization | Hard rule from §8 |

---

## §11 6-Week Milestones

| Week | Goal | Acceptance |
|---|---------|---------|
| **W1** | FastAPI + WS scaffold + dummy echo | Frontend connects WS, receives `server.ack`; `/health` OK |
| **W2** | Postgres schema + recording script + 14 angles + shared unit tests pass | `joint_angles_v1.json` all green; 3 templates inserted |
| **W3** | DTW engine + threshold + problem-joint localization | Offline test on 20 sets, correctness ≥ 80% |
| **W4** | SVM classifier (3 actions) + server-side set_detector | SVM ≥ 90% accuracy; auto `set_event` emission |
| **W5** | Async advice triggers + Redis cache + offline fallback | 3 triggers all return reasonable text; 10/day cap enforced |
| **W6** | Fly.io deploy + monitoring + degradation paths | 100-concurrent WS load test passes (local sim) before Demo |

**Total estimate**: ~65 h (part-time, 10–12 h/week)

---

## §12 Risks (Backend Perspective)

| Risk | Mitigation |
|-----|------|
| DTW thresholds don't generalize across body types | Calibrate against user's own 3 baseline reps |
| SVM accuracy < 70% on real data | Switch to 1D-CNN immediately (interface ready) |
| Advice generation cost runs away | Provider cache + per-user daily cap; monitor daily spend |
| Fly.io scale-to-zero cold start | Ping-keep-alive 1 hour before Demo |
| WS memory grows under 100+ concurrent | Stateless message handlers + Redis user state; add machines if needed |

---

## §13 Extension Placeholders (post-Demo)

> Note: Outside the 6-week sprint.

- **1D-CNN / ST-GCN classifier**: interface ready, swap implementation
- **Multi-view template fallback**: `templates.view_angle` reserved; DTW engine needs "pick nearest view template" logic
- **Horizontal scaling**: FastAPI is stateless; add ML Worker queue (Celery/RQ)
- **Multi-provider advice routing**: `AdviceProvider` interface placeholder; route to different providers

### Trajectory Replay API (post-W5)

When a client submits `world_landmarks` per frame (replay opt-in), the server stores them in `actions.world_landmarks_compressed`. The history API returns them for client-side replay rendering.

**New endpoint**:

```python
@app.get("/api/history/{action_id}")
async def get_action_history(action_id: str, token: str = Depends(verify_jwt)):
    row = await db.fetch_one(
        "SELECT action_id, exercise, correct, dtw_distance, completeness, "
        "problem_joints, joint_angles_compressed, world_landmarks_compressed "
        "FROM actions WHERE action_id = :id", {"id": action_id}
    )
    if not row:
        raise HTTPException(404)
    return {
        "action_id": row["action_id"],
        "exercise": row["exercise"],
        "correct": row["correct"],
        "dtw_distance": row["dtw_distance"],
        "problem_joints": row["problem_joints"],
        "frames": decompress_frames(row["joint_angles_compressed"],
                                    row["world_landmarks_compressed"]),
        "template_frames": load_template_frames(row["exercise"]),
    }
```

`template_frames` is the standard-action series for the exercise — the client Procrustes-aligns it to the user's body proportions and renders both skeletons in different colors.

**Storage cost**: `world_landmarks_compressed` ≈ 4–6 KB per rep (gzip). Nullable; existing rows unaffected.

**Alembic migration**: add nullable column — zero downtime, no backfill required.

```python
# migrations/add_world_landmarks_compressed.py
def upgrade():
    op.add_column("actions",
        sa.Column("world_landmarks_compressed", sa.LargeBinary(), nullable=True))
```

---

## §14 Contract Quick-Reference

| What you need | Jump to |
|---------|------|
| 14 joint-angle indices/formulas | [04 §5](./04_Interface_Contracts.md#5-14-d-joint-angle-definitions) |
| WS upstream messages (you parse) | [04 §3](./04_Interface_Contracts.md#3-phone--cloud-websocket-upstream) |
| WS downstream messages (you send) | [04 §4](./04_Interface_Contracts.md#4-cloud--phone-websocket-downstream) |
| Error codes | [04 §6.1](./04_Interface_Contracts.md#61-error-codes-servererrorcode) |
| Problem-joint codes | [04 §6.2](./04_Interface_Contracts.md#62-problem-joint-codes-problem_jointsissue) |
| DB schema contract | [04 §8](./04_Interface_Contracts.md#8-database-schema-contract-server-internal-but-client-needs-to-know) |
| Minimum integration round-trip | [04 §7](./04_Interface_Contracts.md#7-minimum-round-trip-example-for-joint-integration-testing) |

---

*Last updated: 2026-04-24*
