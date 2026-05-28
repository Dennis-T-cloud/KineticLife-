# KineticLife Server

FastAPI backend for post-set action submissions, template-based DTW analysis, in-memory demo history, and coaching text generation.

Current public routes:

- `GET /health`
- `GET /api/templates`
- `POST /api/actions`
- `GET /api/history/{action_id}`

No durable database in the active code path; submitted actions are stored in process memory.

## Quick Start

```bash
uv sync
uv run uvicorn app.main:app --reload
```

Action submission and data contracts are defined in `../docs/04_Interface_Contracts.md`.

---

## Adding a New Exercise — Complete Checklist

Adding one exercise requires touching **8 locations** across backend and frontend.
Four of them are manual; the rest are automatic once the template file exists.

### Step 1 — Record raw data

Record **6 sets × 6 reps** of the new exercise and place the JSON files in `dtw_training_data/`.
Name them with a consistent prefix, e.g. `myex1.json` … `myex6.json`.

Each file is a JSON array of frames:

```json
[{ "frame_id": 0, "ts_ms": 0, "joint_angles": [<14 floats or nulls>] }, ...]
```

Joint index reference (14-D vector):

```
0  left_knee      1  right_knee     2  left_elbow     3  right_elbow
4  left_hip       5  right_hip      6  left_shoulder  7  right_shoulder
8  left_ankle     9  right_ankle   10  left_wrist    11  right_wrist
12 trunk_lean    13 pelvis_tilt
```

---

### Step 2 — Register the prefix and generate the template

**File:** `server/scripts/generate_templates.py`

Add one entry to `EXERCISE_MAP`:

```python
"myex": ("my_exercise", [key_joint_indices], valley_bool),
```

- **key_joint_indices**: joints with the largest range of motion (drives rep segmentation).
  - Squat / side-squat → `[0, 1]` (knees)
  - Deadlift → `[4, 5]` (hips)
  - Single-arm curl → `[2]` or `[3]` (one elbow)
  - Both-arm curl → `[2, 3]`
  - Lateral raise → `[6, 7]` (shoulders)
- **valley_bool**: `True` if the key angle *drops* at the working position (squat, curl).
  `False` if it *rises* (lateral raise).

Then run:

```bash
python3 server/scripts/generate_templates.py
```

Output: `server/data/templates/my_exercise.json`

> **What becomes automatic after this step:**
> - The template is loaded at server startup via `load_templates()`.
> - `_classify()` scores every submitted action against all templates, including the new one —
>   no code change needed for recognition.

---

### Step 3 — Add key-joint index to the API

**File:** `server/app/main.py` — `_KEY_JOINTS` dict

```python
"my_exercise": [key_joint_indices],
```

Used by `GET /api/templates` to extract the key-angle time series for chart display.
Without this entry the new exercise is silently omitted from the template chart endpoint.

---

### Step 4 — Add spike-detection thresholds

**File:** `server/app/ml/thresholds.py` — `EXERCISE_THRESHOLDS` dict

```python
"my_exercise": SpikeThresholdConfig(
    spike_threshold=4.0,   # degrees mean joint deviation to flag a spike
    min_steps=3,           # minimum aligned steps the spike must span
    merge_gap=1,
    smooth_window=5,
),
```

Reference values by exercise type:

| Type | spike_threshold | min_steps | smooth_window |
|------|----------------|-----------|---------------|
| Compound lower (squat, DL) | 4.0–5.0 | 3 | 5 |
| Isolation upper (curl, lateral raise) | 3.0–3.5 | 2 | 3 |

Without this entry the server falls back to `DEFAULT_THRESHOLD_CONFIG` (auto sigma, min_steps=2),
which usually works but is not tuned to the exercise.

> **`advice/rules.py` does NOT need changes.**
> All 14 joint labels and action phrases are already defined generically.
> Exercise-specific advice is produced by injecting `exercise=classified_exercise` into
> the existing `generate_coaching_text()` call.

---

### Step 5 — Add live rep counter + form checks (frontend)

**File:** `web/lib/exercise-rules.js` — `EXERCISES` object

This drives the real-time rep state machine and bone-coloring feedback on the live screen.
`useIoTConnection.ts` imports `EXERCISES` from this file.

```js
my_exercise: {
  label:        'My Exercise',
  getKeyAngle:  lm => /* MediaPipe landmark angle */,
  restCond:     a => a > REST_THRESHOLD,   // "starting position reached"
  workCond:     a => a < WORK_THRESHOLD,   // "working position reached"
  phaseLabel:   { rest: 'Standing', work: 'Working' },
  checks: [
    {
      id:     'check_id',
      getVal: lm => /* angle or distance */,
      valid:  (v, phase) => /* boolean */,
      hint:   'Cue shown to user',
      bones:  [[landmarkA, landmarkB], ...],  // bones painted red on failure
    },
  ],
  displayAngles: [
    { label: 'Joint Name', fn: lm => /* angle */, joint: landmarkIndex },
  ],
},
```

Key MediaPipe landmark indices (body, bilateral):

```
11 L-shoulder  12 R-shoulder  13 L-elbow  14 R-elbow  15 L-wrist  16 R-wrist
23 L-hip       24 R-hip       25 L-knee   26 R-knee   27 L-ankle  28 R-ankle
```

Helpers available in the file:

- `calcAngle(a, b, c)` — 3-point angle at vertex `b`
- `sideAngle(lm, left3, right3)` — picks the more-visible side automatically (for side-view exercises)
- `avgAngle(lm, left3, right3)` — average of both sides

Threshold derivation from data:

- `restCond`: use p90 of key angle across all rest frames → set threshold slightly below
- `workCond`: use p10 of key angle across all work frames → set threshold slightly above

---

### Step 6 — Register in frontend exercise catalog

**File:** `web/src/routes/kineticlife-app.jsx`

Eight additions in this file (four catalog entries + four runtime entries):

#### 6a. Muscle heatmap intensity

```js
// MUSCLE_INTENSITY_BY_EXERCISE
my_exercise: { quads: 1, hamstrings: 0.7, core: 0.5, ... },
```

Values 0–1 represent relative activation. Primary mover = 1.0.

Available muscle IDs: `shoulders chest biceps triceps core upper_back lower_back quads front_calves hamstrings rear_calves`

#### 6b. EXERCISES list (exercise picker UI)

```js
{
  id:      "my_exercise",
  label:   "My Exercise",
  short:   "ME",    // 2–3 char badge
  muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.my_exercise),
  joints:  ["joint_name_a", "joint_name_b"],
},
```

#### 6c. AI plan rules

```js
// AI_CORE_EXERCISE_RULES
my_exercise: {
  group:    "Lower Body",   // or "Upper Body" / "Arms" / "Posterior Chain"
  baseSets: 3,
  reps:     12,
  risk:     { knee: 70 },   // injury area → exclusion weight (0–100)
},
```

#### 6d. Recovery classification

```js
// EXERCISE_MUSCLE_CLASS  (large = 2–3 days rest, small = 1 day rest)
my_exercise: "large",   // compound movements; "small" for isolations

// EXERCISE_MUSCLE_GROUP_KEY  (conflict detection in rest-day logic)
my_exercise: "lower",   // lower / posterior / push / pull / arms
```

#### 6e. Auto-classifier: exercise ID list

```js
// AUTO_CLASSIFIER_IDS  — exercises eligible for hands-free live classification
// Add to this array so the live classifier can recognise the exercise without a hint.
// Omit if the exercise is too similar to existing ones and would cause false positives.
const AUTO_CLASSIFIER_IDS = [..., "my_exercise"];
```

#### 6f. Auto-classifier: feature spec

Each entry in `AUTO_CLASSIFIER_SPECS` describes how the live classifier scores the exercise.

```js
my_exercise: {
  minAmp: 30,        // minimum key-angle swing to count as movement
  strongAmp: 85,     // swing at which confidence peaks
  rest: 143,         // key angle at rest position
  work: 82,          // key angle at work position
  direction: "down", // "down" if angle drops at work, "up" if it rises
  features: [
    // active: joint must swing with the exercise
    { id: "joint_id", type: "active", weight: 0.34,
      minAmp: 30, strongAmp: 85, rest: 143, work: 82, direction: "down",
      fn: (lm) => classifierAngle(lm[A], lm[B], lm[C]) },
    // quiet: joint must stay still (distinguishes from similar exercises)
    { id: "joint_quiet", type: "quiet", weight: 0.14,
      maxAmp: 24, fn: (lm) => avgFinite(...) },
  ],
},
```

#### 6g. Movement progress formula

`movementProgress()` maps key angle → 0–1 for the live progress ring.
Add an explicit branch if the default squat formula is wrong for the new exercise:

```js
// curl: decreasing angle = increasing effort
if (exerciseId === "my_curl") return Math.max(0, Math.min(1, (155 - keyAngle) / 100));
// lateral raise: increasing angle = increasing effort
if (exerciseId === "my_raise") return Math.max(0, Math.min(1, (keyAngle - 30) / 55));
// default covers squat-like exercises
```

#### 6h. DTW chart angle range

```js
// ANGLE_RANGES — y-axis bounds and reference-curve anchor points for DtwChart
my_exercise: { min: 75, max: 160, rest: 148, work: 85 },
```

`rest` and `work` define the reference sine-wave curve shown on the analysis screen.
Derive from `ANGLE_RANGES` data: `rest` ≈ p90 of standing frames, `work` ≈ p10 of bottom frames.

#### 6i. Analysis advice text

`analysisAdvice()` returns post-set coaching copy.
Add a branch if the exercise needs custom advice beyond the generic squat/curl/raise buckets:

```js
if (ex === "my_exercise") return dtw >= 0.70
  ? "Good pattern. Keep X controlled."
  : "Needs work. Focus on Y.";
```

If the exercise belongs to an existing category (curl, raise, squat), add it to the relevant
`isCurl` / `isRaise` check at the top of the function instead of writing a new branch.

---

## Summary: What Is Automatic vs. Manual

| Touch point | Auto? | File | Notes |
| --- | --- | --- | --- |
| Template loaded at startup | ✅ auto | `server/data/templates/` | Any `.json` dropped here is loaded |
| `_classify()` recognition | ✅ auto | `server/app/main.py` | Scores all templates, picks lowest DTW |
| `advice/rules.py` coaching text | ✅ auto | `server/app/advice/rules.py` | Generic labels cover all 14 joints |
| `EXERCISE_MAP` prefix | ❌ manual | `server/scripts/generate_templates.py` | Maps raw file prefix → exercise key |
| `_KEY_JOINTS` | ❌ manual | `server/app/main.py` | Required for `GET /api/templates` signal |
| `EXERCISE_THRESHOLDS` | ❌ manual | `server/app/ml/thresholds.py` | Falls back to untuned default if missing |
| `EXERCISES` live counter | ❌ manual | `web/lib/exercise-rules.js` | Rep count + form checks on live screen |
| `MUSCLE_INTENSITY_BY_EXERCISE` | ❌ manual | `web/src/routes/kineticlife-app.jsx` | Muscle heatmap visualisation |
| `EXERCISES` list | ❌ manual | `web/src/routes/kineticlife-app.jsx` | Exercise picker UI |
| `AI_CORE_EXERCISE_RULES` | ❌ manual | `web/src/routes/kineticlife-app.jsx` | AI plan generator |
| `EXERCISE_MUSCLE_CLASS` | ❌ manual | `web/src/routes/kineticlife-app.jsx` | Recovery-period logic |
| `EXERCISE_MUSCLE_GROUP_KEY` | ❌ manual | `web/src/routes/kineticlife-app.jsx` | Rest-day conflict detection |
| `AUTO_CLASSIFIER_IDS` | ❌ manual | `web/src/routes/kineticlife-app.jsx` | Hands-free live classification |
| `AUTO_CLASSIFIER_SPECS` | ❌ manual | `web/src/routes/kineticlife-app.jsx` | Feature weights for live classifier |
| `movementProgress()` | ❌ manual | `web/src/routes/kineticlife-app.jsx` | Progress ring formula (if not squat-like) |
| `ANGLE_RANGES` | ❌ manual | `web/src/routes/kineticlife-app.jsx` | DTW chart y-axis and reference curve |
| `analysisAdvice()` | ❌ manual | `web/src/routes/kineticlife-app.jsx` | Post-set coaching copy |

---

## Exercise Inventory

| Exercise key | Data prefix | Key joints | Template frames |
|---|---|---|---|
| `squat` | `sq` | knees [0,1] | ~50 |
| `barbell_squat` | `bsq` | knees [0,1] | ~38 |
| `deadlift` | `dl` | hips [4,5] | ~50 |
| `bicep_curl` | `lbi` / `lib` | right_elbow [3] | ~41 |
| `right_bicep_curl` | `rbi` | left_elbow [2] | ~33 |
| `lateral_raise` | `lbrid` | shoulders [6,7] | ~39 |
| `squat_side` | `sides` | knees [0,1] | ~38 |
| `both_bicep_curl` | `bothcurl` | both elbows [2,3] | ~43 |

To regenerate all templates from raw data:

```bash
python3 server/scripts/generate_templates.py
```
