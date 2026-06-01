# KineticLife Business Layer Migration Handoff

> Purpose: give the next AI a concrete migration checklist for moving the useful business layer from this repo into the newer XIAO + Grove Vision AI + keypoint-stream project. The target project already has accurate, smooth keypoints and a Web skeleton display, so it should remain the host. Do not transplant the old ESP32 JPEG/MediaPipe camera pipeline unless explicitly needed for debugging.

## 1. Migration Goal

Move the parts of KineticLife that define the product experience:

- Exercise definitions, rep counting, form checks, motion classification, and post-set scoring.
- Training flows: Jump-in, Plan, Home Workout, Analysis, Profile, Core, Nexus.
- UI language, theme tokens, animation assets, home entry imagery, coach/reward copy, and muscle recovery model.

Do not move the historical transport stack:

- ESP32 JPEG WiFi WebSocket stream.
- BLE JPEG chunk stream.
- Browser-side MediaPipe `detectForVideo`.
- JPEG decode, canvas rotation, undistortion workers, `/cam` config, `ws_token` camera path, pair/debug tooling.

The new project should provide this input to the migrated logic:

```js
{
  t: 123456.7,
  fps: 12,
  source: "grove-ai",
  keypoints: [
    { name: "left_shoulder", x: 0.42, y: 0.31, score: 0.91 },
    // ...
  ]
}
```

Then KineticLife logic should output:

```js
{
  reps,
  phase,
  exerciseId,
  confidence,
  formScore,
  dtw,
  hint,
  errorBoneSet,
  targetProgress,
  sessionResult
}
```

## 2. Files To Package

### Directly Useful Files

Copy these first, then adapt imports:

- `web/lib/exercise-rules.js`
  - Best single source of exercise business logic.
  - Contains `calcAngle`, `boneKey`, `BONE_PAIRS`, `ALL_JOINTS`, `VIS`, and `EXERCISES`.
  - `EXERCISES` defines `getKeyAngle`, `restCond`, `workCond`, `checks`, `displayAngles`, and labels.

- `web/lib/landmark-smoothing.js`
  - Display-only EMA smoother.
  - Important principle in comments: raw landmarks should drive rep/form logic; smoothed landmarks are for rendering.

- `web/lib/pose-renderer.js`
  - Optional if the target project wants the current holographic skeleton style.
  - Depends on MediaPipe-style landmark indices from `exercise-rules.js`.
  - Can be replaced by the target project's renderer if it is already smoother.

- `web/lib/feedback-effects.js`
  - Optional rep success particles / DOM counter pop effects.
  - Pure Canvas/DOM, no hardware dependency.

- `web/src/assets/*.json`
  - Lottie assets used by Home Workout / coach / reward flows:
    - `ai-core.json`
    - `Avocado_walking.json`
    - `blue_jumping.json`
    - `cheering_ribbons.json`
    - `home_Jumping_Jack.json`
    - `home_Squat_Kick.json`
    - `path_clear.json`
    - `Set_clear.json`
    - `squrt_walking.json`
    - `Trophy.json`

- `web/src/assets/home-entry/*.svg`
  - Home entry cards for Jump-in, AI Plan, and Home Mode in both themes.

### Extract From `web/src/routes/kineticlife-app.jsx`

This file is a monolith. Do not copy it wholesale. Extract the following sections into clean modules:

- Product constants and exercise metadata:
  - `MUSCLE_GROUPS`
  - `MUSCLE_INTENSITY_BY_EXERCISE`
  - local `EXERCISES` array with `id`, `label`, `short`, `muscles`, `joints`
  - `AI_CORE_INJURY_OPTIONS`
  - `AI_CORE_EXERCISE_RULES`
  - `EXERCISE_MUSCLE_CLASS`
  - `EXERCISE_MUSCLE_GROUP_KEY`
  - `MUSCLE_RECOVERY_DAYS`
  - `HOME_ROUTES`
  - `KINI_LINES`
  - `HOME_LIVE_WORDS`
  - `CARDIO_MILESTONES`
  - `NEXUS_MOODS`
  - `NEXUS_MOCK_CHECKINS`

- User/profile/local persistence helpers:
  - `normalizeUserId`
  - `userStorageKey`
  - `getActiveUserName`
  - `setActiveUserName`
  - `loadKnownUsers`
  - `registerKnownUser`
  - `loadProfile` / `saveProfile`
  - `loadMuscleStatus` / `saveMuscleStatus`
  - `decayedMuscleStatus`
  - `loadAiCoreProfile` / `saveAiCoreProfile`
  - `loadAiMessages` / `saveAiMessages`
  - `loadNexusCheckins` / `saveNexusCheckins`

- Planning and recovery business logic:
  - `generateAiCorePlan`
  - `buildWeekSchedule`
  - `getExerciseTargets`
  - `defaultBodyViewForMuscles`
  - `muscleHeatLevel`
  - `muscleHeatColor`
  - `muscleHeatOpacity`

- Motion engine helpers:
  - `movementProgress`
  - `AUTO_CLASSIFIER_IDS`
  - `AUTO_REP_CONFIRMATIONS_REQUIRED`
  - `AUTO_CLASSIFIER_SPECS`
  - `makeAutoClassifierState`
  - `classifyMotionWindow`
  - `scoreAnglePattern`
  - `scoreQuietFeature`
  - `scoreAutoExercise`

- Core/AI text logic:
  - `makeAiMessage`
  - `inferInjuryTagsFromText`
  - `CORE_REPLIES`
  - `PLAN_DIALOGUE`
  - `pickReply`

- UI components to copy or rewrite:
  - `AuthScreen`
  - `DashboardScreen`
  - `PlanConfigScreen`
  - `HomeWorkoutContainer`
  - `HomeCoachScreen`
  - `CardioCountdownScreen`
  - `HomeSetRestScreen`
  - `HomeExerciseDoneScreen`
  - `HomeRewardScreen`
  - `AnalysisScreen`
  - `ProfileScreen`
  - `SettingsScreen` only if the target still needs app settings; skip old camera settings.
  - `CoreScreen`
  - `NexusCheckInScreen`
  - `MuscleBodyMap` and supporting body-map SVG/CSS logic inside the same file.

### DTW / Analysis Logic

There are two different "DTW" concepts in the current repo:

- Current LiveScreen real-time `DTW xx%` in `kineticlife-app.jsx` is not true dynamic time warping. It is a smoothed form-check proxy:
  - frame error -> lower score
  - clean frame -> higher score
  - EMA smoothing

- True local/server DTW lives in `web/src/hooks/useIoTConnection.ts`:
  - `compute14Angles`
  - `buildGolden`
  - `computeLocalDTW`
  - `submitServerDTW`
  - `AnalysisResult` shape

For the target project:

- Prefer migrating true DTW only as post-set analysis, not as a per-frame UI blocker.
- Keep real-time feedback based on rules/form checks and `movementProgress`.
- If using the existing DTW helpers, extract them into a standalone module such as `src/motion/dtw.js`.
- Do not migrate the rest of `useIoTConnection.ts`; most of it is obsolete transport/MediaPipe pipeline.

## 3. Files Not To Package

Do not copy these into the new hardware project unless you need a temporary compatibility mode:

- `web/src/workers/camera-stream.worker.js`
- `web/src/workers/pose-inference.worker.js`
- `web/src/hooks/useIoTConnection.ts` transport sections
- `web/mediapipe_loader.mjs`
- `web/public/undistort.worker.js`
- `web/pair.html`
- `web/debug.html`
- `web/demo.html`
- `web/demo-table.html`
- `web/kinetic-demo.html`
- `web/runtime_log.mjs`
- `web/log_server.py`

Also remove or replace these package dependencies in the target if no longer needed:

- `@mediapipe/tasks-vision`
- old QR/debug-only tooling

Keep if the target UI uses them:

- `react`
- `react-dom`
- `framer-motion`
- `lottie-react`
- `@dicebear/core`
- `@dicebear/thumbs`

## 4. Target Architecture

Recommended module layout in the new project:

```text
src/
  pose/
    poseAdapter.js              # Grove/YOLO keypoints -> MediaPipe-like landmark array
    poseSmoothing.js            # display-only smoothing/interpolation
  motion/
    exerciseRules.js            # from web/lib/exercise-rules.js
    repCounter.js               # rest/work/rest state machine
    autoClassifier.js           # classifyMotionWindow extracted from kineticlife-app.jsx
    formChecks.js               # wraps exercise.checks
    dtw.js                      # optional post-set true DTW
    sessionReducer.js           # session state -> SessionResult
  training/
    muscleModel.js              # muscle groups, intensity, recovery load/decay
    planGenerator.js            # generateAiCorePlan/buildWeekSchedule
    homeRoutes.js               # HOME_ROUTES/KINI_LINES/cardio milestones
    profileStore.js             # localStorage/profile/messages/checkins
  ui/
    screens/
    components/
    assets/
```

The important boundary:

```text
Device keypoint stream
  -> poseAdapter
  -> motion engine using raw landmarks
  -> render engine using smoothed/interpolated landmarks
  -> React UI state at low frequency
```

Do not feed interpolated/smoothed/faked landmarks into rep counting, form checks, or DTW.

## 5. Pose Adapter Contract

The existing exercise rules expect a MediaPipe Pose-style landmark array using these indices:

```text
0  nose
11 left_shoulder
12 right_shoulder
13 left_elbow
14 right_elbow
15 left_wrist
16 right_wrist
23 left_hip
24 right_hip
25 left_knee
26 right_knee
27 left_ankle
28 right_ankle
31 left_foot_index  optional
32 right_foot_index optional
```

Each landmark should look like:

```js
{ x: 0.42, y: 0.31, z: 0, visibility: 0.91 }
```

If the Grove/YOLO model outputs COCO-17 order, map it like this:

```text
COCO 0  nose           -> MP 0
COCO 5  left_shoulder  -> MP 11
COCO 6  right_shoulder -> MP 12
COCO 7  left_elbow     -> MP 13
COCO 8  right_elbow    -> MP 14
COCO 9  left_wrist     -> MP 15
COCO 10 right_wrist    -> MP 16
COCO 11 left_hip       -> MP 23
COCO 12 right_hip      -> MP 24
COCO 13 left_knee      -> MP 25
COCO 14 right_knee     -> MP 26
COCO 15 left_ankle     -> MP 27
COCO 16 right_ankle    -> MP 28
```

Adapter requirements:

- Normalize coordinates to 0..1 in the displayed camera frame.
- Convert confidence/score to `visibility`.
- Fill missing MP indices with `{ x: 0, y: 0, z: 0, visibility: 0 }`.
- Handle camera mirroring explicitly. The old code has several left/right naming mismatches caused by camera orientation; verify with a known left-arm/right-arm curl test.
- Keep raw adapted landmarks immutable per frame; create separate smoothed landmarks for drawing.

## 6. Motion Engine Behavior To Preserve

### Rep Counting

Current rule:

```text
restCond(keyAngle) -> phase = rest
workCond(keyAngle) -> phase = work
work -> rest transition -> count 1 rep
```

The target should preserve this, but implement it in a standalone state object:

```js
const state = {
  exerciseId,
  phase: "rest",
  reps: 0,
  keyAngles: [],
  errorBoneSet: new Set(),
  hints: [],
};
```

### Form Checks

For the active exercise:

```js
for (const check of activeRules.checks) {
  const value = check.getVal(rawLm);
  const ok = check.valid(value, phase);
}
```

Failures should:

- Add red/error bones using `check.bones`.
- Push `check.hint`.
- Lower the real-time form score.
- Accumulate problem joint counts for post-set analysis.

### Auto Classification

`classifyMotionWindow` uses a 2.8 second sliding window of key angles and feature angles. It is useful for Jump-in, but it should be treated as a candidate selector, not as a hard truth.

Recommended target behavior:

- Run classifier on raw keypoints.
- Debounce action switches.
- Require 1-2 confirmed reps before finalizing auto-assigned exercise.
- Let user override classification if needed.

### Visual Smoothness

Use display-only smoothing/interpolation:

- `createSmoother` or target project's existing smoother.
- Landmark interpolation between real keypoint frames.
- Low-confidence joint locking to reduce drift.

Never use interpolated frames for:

- `getKeyAngle`
- `workCond` / `restCond`
- `checks`
- `classifyMotionWindow`
- DTW

## 7. UI / Product Structure To Preserve

### Main Screens

Current app flow:

```text
Auth
  -> Dashboard
      -> Jump-in
      -> AI Plan
      -> Home Workout
  -> Live
  -> Analysis
  -> Profile
  -> Core
  -> Nexus
  -> Settings
```

For the new project, remove the old `ConnectScreen` unless the target still needs device setup. Jump-in can go directly to Live if keypoints are already streaming.

### Dashboard

Three first-screen actions:

- Jump-in: immediate live session with auto classification.
- AI Plan: opens plan generator based on fatigue/recovery/focus/injury profile.
- Home Workout: game-like bodyweight route flow.

Use `HOME_ENTRY_IMAGES` assets for the current visual identity.

### Plan

Keep:

- AI Core profile inputs: height, weight, training days/week, injuries, focus muscles.
- `generateAiCorePlan`.
- `buildWeekSchedule`.
- `MuscleBodyMap` focus selection / muscle heat display.

Remove:

- Any camera connection controls from Plan.

### Home Workout

Keep:

- `HOME_ROUTES`:
  - `APEX PROTOCOL`: both-arm curl, lateral raise, jumping jacks.
  - `FORGE PROTOCOL`: squat, deadlift, squat kicks.
- `KINI_LINES` coach copy.
- Lottie preview / reward assets.
- Set rest, exercise done, reward flow.

Target project should replace any old LiveScreen transport with the keypoint stream session engine.

### Analysis

Keep:

- Score ring / accuracy presentation.
- Classified movement summary.
- Reps, elapsed, form score.
- Problem-joint/hint summary.
- Share to Nexus check-in.

Clarify language:

- If using true DTW, call it DTW.
- If using form-check proxy, call it form score or alignment score.

### Profile

Keep:

- `profile.sessionsCount`
- `profile.averageForm`
- muscle heatmap using `muscleStatus`
- recovery decay model using `_updatedAt`

### Core

Keep:

- Local chat history.
- Rule-based replies for plan generation, fatigue, progress, motivation, technique, recovery, nutrition.
- Injury tag inference from text.

This is not a real LLM integration yet; it is local scripted intelligence.

### Nexus

Keep if desired:

- Mood check-in.
- Mock athlete nodes.
- Recent session sharing.

This is mostly social/prototype UI, not core motion logic.

## 8. Current Business Data Shapes

### SessionResult

Current LiveScreen returns approximately:

```js
{
  reps,
  elapsed,
  dtw,
  keyAngles,
  exerciseId,
  classification: {
    mode: "auto" | "manual",
    exerciseId,
    confidence,
    status,
    repsByExercise,
    actionRows,
    stats: {
      totalFrames,
      classifiedFrames,
      unknownFrames,
      switches
    }
  }
}
```

### Profile

```js
{
  name,
  sessionsCount,
  averageForm,
  streakDays
}
```

### Muscle Status

```js
{
  shoulders: 0.3,
  biceps: 0.8,
  quads: 0.6,
  _updatedAt: {
    biceps: 1710000000000
  }
}
```

### AI Core Profile

```js
{
  heightCm,
  weightKg,
  trainingDaysPerWeek,
  injuryTags,
  focusTags,
  updatedAt
}
```

### AI Message

```js
{
  id,
  role: "ai" | "user",
  type: "text" | "daily_plan" | "post_workout",
  timestamp,
  content,
  payload
}
```

## 9. Migration Order For Next AI

1. Create a pose adapter in the target project and verify one static frame maps to correct MP-style indices.
2. Copy `web/lib/exercise-rules.js` into the target as `motion/exerciseRules.js`.
3. Build a tiny `repCounter` around `getKeyAngle`, `workCond`, and `restCond`.
4. Feed live Grove/YOLO keypoints into rep counting for one exercise: `squat`.
5. Add form checks and error bones for the same exercise.
6. Add display-only smoothing/interpolation.
7. Add `classifyMotionWindow` for Jump-in auto classification.
8. Add post-set `SessionResult`.
9. Copy planning/recovery/profile logic.
10. Copy or recreate UI screens in the target project's style.
11. Add optional true DTW post-set analysis.
12. Remove all old camera/MediaPipe-specific imports.

## 10. Stability Expectations

Expected stability if the target keypoint stream is already smooth:

- Higher than current KineticLife WiFi/MediaPipe path.
- Lower device/network bandwidth.
- Lower browser main-thread pressure.
- Much less chance of WS/JPEG/backpressure freezes.

Main risks after migration:

- Landmark index mismatch.
- Camera mirroring causing left/right exercise labels to invert.
- YOLO/COCO 17-point model missing some MediaPipe-specific points.
- Existing thresholds tuned for MediaPipe may need recalibration.
- Monolithic React code has timers and state coupling; extract logic before copying UI wholesale.

## 11. Acceptance Checklist

Minimum viable migration:

- `squat` rep counting works from Grove/YOLO keypoints.
- Skeleton display remains smooth while raw logic uses only real keypoint frames.
- Form check hints trigger from `exercise-rules.js`.
- Session end produces `SessionResult`.
- Profile `sessionsCount`, `averageForm`, and `muscleStatus` update.
- Plan can generate a workout from current muscle status.

Full migration:

- Jump-in auto classification works for squat, curls, lateral raise, and deadlift side.
- Home Workout routes run end-to-end.
- Analysis screen shows accuracy/form summary and classified reps.
- Core chat can generate plan and summarize progress.
- Nexus check-in works.
- No dependency on old ESP32 JPEG stream, BLE image chunks, or browser MediaPipe.

## 12. Important Cautions

- Do not copy `kineticlife-app.jsx` as a whole. It mixes UI, device connection, MediaPipe, motion logic, storage, and screens in one file.
- Do not copy the current LiveScreen camera pipeline. Replace it with the target keypoint stream.
- Do not use smoothed/interpolated landmarks for scoring or rep counting.
- Do not call the current LiveScreen real-time score "true DTW" unless you replace it with actual DTW.
- Validate left/right with explicit tests:
  - right-arm curl
  - left-arm curl
  - both-arm curl
  - lateral raise
- Keep the target project's smooth keypoint renderer if it is already better than `pose-renderer.js`.
