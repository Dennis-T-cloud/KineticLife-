# 02 · Web Frontend + MediaPipe

> **Version**: v0.3
> **Audience**: Frontend + MediaPipe engineer
> **Contracts**: For external data formats, MUST read [`04_Interface_Contracts.md`](./04_Interface_Contracts.md) §2 / §3 / §4 / §5

---

## §1 Scope & External Commitments

| You own | You don't own |
|---------|---------------|
| **Local stream/demo pages** (`pair.html`, `debug.html`, `demo.html`, `demo-table.html`) — ESP32 WebSocket client, MediaPipe, live UI | ESP32 firmware |
| **Main app shell** — entry, pairing, demo routing, results UI | DTW server implementation |
| MediaPipe Pose integration + 14-angle calc ([04 §5](./04_Interface_Contracts.md#5-14-d-joint-angle-definitions)) | Classifier training |
| Local heuristic rep counting and form checks | |
| Completed-rep buffering for optional DTW summary submission | Server-side advice generation |
| Cloud REST client for post-set DTW summary reports (honoring [04 §3.5 / §4](./04_Interface_Contracts.md#35-clientaction_submit--completed-action-sequence-post-set-dtw-report)) | |
| Demo Day iPad UI tuning | |

**External commitments**:

- Demo pages connect to `ws://fitcam-xxxxxx.local/ws` and render skeleton overlay at ≥ 15 FPS when ESP32 is available
- Live rep counting and red/green feedback are local heuristic checks, not cloud-gated
- 14-angle calculation for DTW reports must **strictly match** server formulas (shared fixture tests in §4 must pass)
- On Finish Set, the page can POST completed-rep angle sequences to the cloud API over HTTPS for a DTW summary report

---

## §1.5 Two-Layer Web Architecture

The browser mixed-content policy blocks `ws://` connections from `https://` pages. The project solves this without a video relay server and without TLS on the ESP32:

```
https://kineticlife.app          http://fitcam-xxxxxx.local/
  (GitHub Pages / Vercel)          (ESP32 SPIFFS — local network)
────────────────────────         ──────────────────────────────
  Login / auth                     WebSocket ← binary JPEG frames
  Course library                   MediaPipe inference (local)
  Results display       ◄─POST─    local heuristic reps + optional DTW report
  History / summary       HTTPS    completed-rep joint angles only (no video)
```

**Why this works**:

- The SPIFFS page is served over `http://`, so `ws://` connections are same-scheme — no mixed content.
- An `http://` page can make HTTPS `fetch()` requests to the cloud API (the restriction only goes the other way: HTTPS pages cannot load HTTP sub-resources).
- Video frames never leave the local hotspot network at any point.

**Why not a relay server**: routing video through a relay means raw frames pass through a third-party server, breaking the privacy guarantee. The SPIFFS approach avoids this entirely.

**User flow**:

1. User visits `https://kineticlife.app` — logs in, selects exercise
2. Pairs ESP32 via `pair.html` (Soft AP or QR)
3. Main app opens the local demo page with `?cam=<url>`
4. Demo page: video streams locally, MediaPipe runs, heuristic rep/form checks drive live UI
5. User presses Finish Set → local summary appears immediately
6. If DTW reporting is enabled, page POSTs completed-rep `joint_angles` to `https://api.kineticlife.app` and merges the returned report into the summary card

---

## §2 Tech Stack

| Layer | Choice | Notes |
|---|------|------|
| Framework | **React 18 + Vite** | TS strict mode |
| State | **Zustand** | Lightweight, no Redux boilerplate |
| Styling | **Tailwind CSS** | Fast UI |
| Pose | **`@mediapipe/tasks-vision` PoseLandmarker** | MUST enable `worldLandmarks` |
| Rendering | **Canvas 2D** | Skeleton + Demo Mode FX; not Three.js |
| Routing | React Router v6 | |
| WebSocket | Native `WebSocket` + custom reconnect | |
| Offline cache | IndexedDB (via `idb`) | |
| QR generation | `qrcode` npm | For ESP32 to scan |
| PWA | Vite PWA plugin | Add to home + offline Demo Mode |

**Project layout**:
```
web/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── main.tsx
│   ├── routes/
│   │   ├── Entry.tsx          # Dual-entry selector
│   │   ├── Pair.tsx           # WiFi QR pairing
│   │   ├── JumpIn.tsx
│   │   ├── Duolingo/
│   │   └── Demo.tsx
│   ├── capture/
│   │   ├── mjpegSource.ts     # Pull from ESP32
│   │   └── wifiQr.ts          # Generate WIFI:S:...
│   ├── pose/
│   │   ├── landmarker.ts      # MediaPipe wrapper
│   │   └── jointAngles.ts     # 14 angles (contract §5)
│   ├── edge/
│   │   ├── segmenter.ts       # Action segmentation
│   │   ├── repCounter.ts      # Auto rep (peak detection)
│   │   ├── gestureDetector.ts # Gestures
│   │   └── edgeDtw.ts         # Light DTW (rough)
│   ├── render/
│   │   ├── skeleton.tsx       # Canvas skeleton
│   │   ├── procrustes.ts      # Standard-action morphing
│   │   └── demoFx.ts          # Demo Mode FX
│   ├── api/
│   │   ├── ws.ts              # WS client (contracts §3/§4)
│   │   └── offlineQueue.ts    # Offline replay
│   ├── store/
│   │   └── session.ts         # Zustand
│   └── types/
│       └── contracts.ts       # TS types translated from §3/§4
├── lib/                      # Current static demo shared modules
│   ├── exercise-rules.js     # Exercise thresholds, angle math, skeleton constants
│   ├── landmark-smoothing.js # Display-only EMA smoothing
│   ├── pose-renderer.js      # Canvas skeleton + angle annotations
│   └── feedback-effects.js   # Rep count, particle, scanline, error-pulse effects
├── mediapipe_loader.mjs      # Current remote/local MediaPipe fallback
├── runtime_log.mjs           # Current low-frequency browser diagnostics
├── vite.config.ts
└── package.json
```

The TypeScript `src/` tree remains the future app-shell direction. The current demo-day pages are static HTML entry points (`debug.html`, `demo.html`, `demo-table.html`) that import shared ES modules from `web/lib/` plus `mediapipe_loader.mjs` and `runtime_log.mjs`.

---

## §3 MediaPipe Pose Integration

**Model**: `@mediapipe/tasks-vision` `PoseLandmarker` (2024+ task version, 2× faster than legacy Pose)

**Key config**:

```ts
// pose/landmarker.ts
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

export const landmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "/models/pose_landmarker_lite.task",  // lite variant
    delegate: "GPU",                                       // WebGL acceleration
  },
  runningMode: "VIDEO",
  numPoses: 1,
  outputSegmentationMasks: false,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
});
```

**Inference**:
```ts
const result = landmarker.detectForVideo(videoEl, performance.now());
const worldLandmarks = result.worldLandmarks[0];  // 33 × {x,y,z,visibility}
const imageLandmarks = result.landmarks[0];       // for screen rendering
```

**Important**:
- Current live demo uses `landmarks` (2D normalized image coords) for heuristic rep/form checks because it matches the on-screen skeleton and keeps the flow simple.
- DTW summary reporting should use the 14-D `joint_angles` contract. In the full contract those angles are computed from `worldLandmarks` for view invariance; the demo heuristic path may use 2D angles only for live UI.
- Display landmarks may be smoothed for UX; rep counting and form checks should use raw landmarks unless explicitly noted.

---

## §4 14-D Joint Angle Computation (Critical)

**Contract**: [`04 §5`](./04_Interface_Contracts.md#5-14-d-joint-angle-definitions), `joint_angles_version = 1`

**Implementation**:

```ts
// pose/jointAngles.ts
import type { WorldLandmark } from "./types";

const idx = {
  L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28,
  L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16, L_INDEX: 19, R_INDEX: 20,
  L_FOOT_INDEX: 31, R_FOOT_INDEX: 32,
};

function vec(a: WorldLandmark, b: WorldLandmark): [number, number, number] {
  return [b.x - a.x, b.y - a.y, b.z - a.z];
}

function angleDeg(v1: [number, number, number], v2: [number, number, number]): number {
  const dot = v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
  const m1 = Math.hypot(...v1);
  const m2 = Math.hypot(...v2);
  if (m1 < 1e-6 || m2 < 1e-6) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180 / Math.PI;
}

export function compute14Angles(lm: WorldLandmark[]): (number | null)[] {
  const v = (i: number, threshold = 0.3) =>
    lm[i].visibility >= threshold ? lm[i] : null;

  // 0: left_knee
  const a0 = v(idx.L_HIP) && v(idx.L_KNEE) && v(idx.L_ANKLE)
    ? angleDeg(vec(lm[idx.L_HIP], lm[idx.L_KNEE]), vec(lm[idx.L_KNEE], lm[idx.L_ANKLE]))
    : null;
  // ... same for idx 1-13

  return [a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13];
}
```

**Unit tests** (must be 100% green; **server reuses the same fixtures**):

```ts
// __tests__/jointAngles.test.ts
import { compute14Angles } from "../pose/jointAngles";
import fixtures from "./fixtures/joint_angles_v1.json";

describe("14 joint angles v1", () => {
  for (const fx of fixtures) {
    it(fx.name, () => {
      const result = compute14Angles(fx.landmarks);
      expect(result).toEqual(fx.expected);
    });
  }
});
```

`joint_angles_v1.json` is the **shared test fixture** (in repo root `shared/fixtures/`). Backend uses the same data — guarantees formula consistency between sides.

---

## §5 Local Heuristic Feedback + Post-set DTW Report

**Purpose**: Keep the live experience stable and immediate. Local heuristic logic drives the counter, red skeleton highlights, and Finish Set summary. DTW is a post-set report layer, not the real-time main path.

**Full pipeline**:

```text
Continuous stream (ESP32 WS JPEG or local camera)
  │
  ▼ (every frame)
MediaPipe inference → image landmarks + optional joint_angles[14]
  │
  ▼
Local heuristic checks
  │  rest/work state machine + per-exercise form rules
  ▼
Live UI: skeleton, hints, rep counter
  │
  ├─ buffer completed reps as joint-angle sequences
  ▼
Finish Set
  │
  ├─ immediate local summary: reps, duration, heuristic form quality
  ▼
optional client.action_submit per completed rep → cloud DTW report items
  │
  ▼
summary card aggregates: template similarity, correct_count, avg_completeness, problem_joints
```

Key implication: DTW only runs on completed reps or a completed set — **never on the raw continuous stream**. Local heuristic state machines remain the source of the live interaction.

**Current demo segmentation** (`demo.html` / `demo-table.html`):
- Each exercise defines a key angle, a `restCond`, and a `workCond`
- A rep is counted on `neutral → rest → work → rest`
- Per-exercise checks produce form hints and red bone highlights
- Display landmarks can be EMA-smoothed; logic should use raw landmarks
- Shared exercise thresholds and angle math live in `web/lib/exercise-rules.js`
- Shared display smoothing lives in `web/lib/landmark-smoothing.js`
- Shared skeleton rendering lives in `web/lib/pose-renderer.js`
- Shared non-authoritative visual effects live in `web/lib/feedback-effects.js`

**DTW report submission**:
- Submit only completed-rep `joint_angles[T,14]` sequences
- Prefer one request per completed rep with browser-side aggregation, matching the current `/api/actions` shape
- If the server is unavailable, keep the local summary and label DTW report as unavailable

---

## §6 Gesture Detection

**Contract**: On trigger, send [`client.gesture`](./04_Interface_Contracts.md#33-clientgesture--gesture-event)

**5 gestures** (derived directly from Pose keypoints):

| Gesture | Detection rule (worldLandmarks simplified) | Trigger |
|-----|-----------------------------------|---------|
| Both hands overhead | `L_WRIST.y < NOSE.y AND R_WRIST.y < NOSE.y` for 1.5 s | `start` |
| Arms crossed at chest | `L_WRIST.x > R_SHOULDER.x AND R_WRIST.x < L_SHOULDER.x` and wrist.y at chest, 1.5 s | `end_set` |
| One hand overhead | Only one side `WRIST.y < NOSE.y`, 1 s | `pause` / `resume` |
| T-Pose | `\|WRIST.y - SHOULDER.y\| < 0.1m` and wrists horizontal distance > 1.5× shoulder width, 2 s | `calibrate` |
| Point at camera | `WRIST.z - SHOULDER.z < -0.3m` (hand toward cam), 1 s | `toggle` |

**Implementation notes** (`edge/gestureDetector.ts`):
- State machine: `IDLE → CANDIDATE(seenAt) → CONFIRMED(if duration ≥ holdMs)`
- **Same gesture can't retrigger within 3 s** (debounce)
- UI feedback: edge progress bar fills as detection holds; brief flash on completion

**Expected accuracy**: Under ideal conditions, recognition rate >98%, false trigger <2%.

---

## §7 Auto Rep / Set Detection (Client-side)

**Contract**: Client-side heuristic detection is authoritative for the current Demo UI. Server-side DTW may refine the post-set report but should not block counting or live feedback.

**Algorithm** (`edge/repCounter.ts`):

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> ReadyDetected: "Ready pose" 1.5s
    ReadyDetected --> Repping: Indicator starts changing
    Repping --> Repping: Detected periodic peak → rep+1
    Repping --> Resting: 3s no significant motion
    Resting --> Repping: Motion resumes within 5s (same set)
    Resting --> SetEnded: Over 5s no motion / end_set gesture
    SetEnded --> Idle
```

**Per-action indicator**:

| Action | Indicator | One complete rep |
|-----|--------|-------------|
| Squat | `MID_HIP.y` | Down to bottom → return to start |
| Push-up | `MID_SHOULDER.y` or elbow angle | Same |
| Plank | (no period; stable hold ≥ 30s) | — |
| Bicep curl | `elbow` angle | Extend → curl → extend |

**Peak detection** (simplified, JS-side):
- Sliding mean smoothing (window 5 frames)
- Local extremum: current value smaller/larger than 3 frames on each side AND opposite direction from previous extremum

**Manual fallback**: **Finish Set** remains visible. It finalizes the local summary immediately and optionally starts the DTW report request.

---

## §8 Dual Entry + Routes

| Route | Mode | Key UI |
|-----|------|---------|
| `/` | Entry | 3 buttons: Jump-in / Duolingo / Demo |
| `/pair` | Pairing | Show WiFi QR + ESP32 status |
| `/jump-in` | Main | Camera + skeleton + scrolling classifier hint |
| `/duolingo` | Course | Today's action cards (slim version OK by W5) |
| `/demo` | Demo | Skeleton + visual FX |
| `/history` | History playback (post-W5, optional) | — |

**Future full-app differences**:

| Aspect | Jump-in | Duolingo |
|-----|---------|---------|
| Time-to-camera | tap → camera ≤ 2 s | login → choose → start |
| `client.hello.action_hint` | `null` | user's choice |
| Classifier calls | rolling (every 500 ms) | known action |
| Advice generation | none | login + set_end + day_end |

---

## §9 Demo Mode Visualization (Booth B's Soul)

**Goal**: iPad in landscape, **skeleton-only with visual FX, no raw video** (privacy as visual proof).

**Visual elements**:

| Element | Implementation |
|-----|------|
| Background | Dark gradient + slow-flowing grid particles (Canvas 2D + rAF) |
| Skeleton | White gradient lines, glowing joint dots (`shadowBlur`) |
| Trails | 2 s trailing on hands/feet (rolling buffer of last 30 frames of joint coords) |
| Particle bursts | On local heuristic rep count or later DTW-confirmed correct rep |
| Success scanline | Lime sweep over the display skeleton after a counted rep |
| Error highlight | Local form-rule failures pulse red in real time; DTW `problem_joints` may appear in the summary |
| Big counter | Corner DOM number |
| SFX | Web Audio API: "ding" right, "buzz" wrong |

Current implementation: `web/lib/feedback-effects.js` provides the first demo-day effect layer without external dependencies. It adds a lime rep counter pop, a small `+N` float, a short particle burst near the torso, a lime success scanline, and a red pulse over debounced failing bones. These effects are display-only and must not change rep counting, form thresholds, or summary scoring.

**Performance target**: ≥ 30 FPS on iPad Pro; degrade to 20 FPS on lower-end.

**Why not Three.js**: 2D Canvas already looks great, Three.js is heavy and unstable for Demo Day.

---

## §10 Procrustes Morph Overlay

**Goal**: Overlay a **standard-action skeleton morphed to match the user's body** so they see "this is what you should look like".

**Algorithm** (`render/procrustes.ts`):
1. Take template keypoints + user current keypoints
2. Compute Procrustes alignment (translate + scale + rotate, minimize sum-of-squares)
3. Map template through transform into user's coordinate frame
4. Draw both (user solid + template translucent dashed)

**Library**: No third-party — direct SVD via `mathjs` (<50 LOC).

---

## §11 Summary Report Client

**Contract**: Strictly follow [04 §3.5 / §4](./04_Interface_Contracts.md#35-clientaction_submit--completed-action-sequence-post-set-dtw-report) for completed action submissions and report responses.

**Implementation notes** (`api/reportClient.ts`, or the equivalent current demo script):
- REST-first for current demo: submit completed reps at Finish Set
- Retry with exponential backoff (1s, 2s, 4s, max 30s) for summary submissions
- **Offline queue** (`api/offlineQueue.ts`): on disconnect, write completed `client.action_submit` summaries to IndexedDB; replay on reconnect
- Realtime frames are not sent to cloud in the current demo and are never cached
- Version: send `v: 1` in `client.action_submit`; if the report endpoint rejects the version, keep the local summary and show a non-blocking warning

**TS types**: 1-to-1 translation from `04 §3.5 / §4` into `src/types/contracts.ts`. **Don't define your own**:

```ts
// src/types/contracts.ts (translated from contracts §3.5/§4)
export type ClientActionSubmit = {
  v: 1;
  type: "client.action_submit";
  session_id: string;
  action_id: string;
  exercise_hint: string;
  // ...
};
// Same for action response / ServerFeedback summary items / ...
```

---

## §12 6-Week Milestones

| Week | Goal | Acceptance |
|---|---------|---------|
| **W1** | Connect ESP32 video + skeleton render | WebSocket `/ws` receives frames; skeleton overlay renders ≥ 9 FPS |
| **W2** | MediaPipe 3D + 14 angles + shared unit tests pass | `joint_angles_v1.json` all green (both client and server) |
| **W3** | Local heuristic rep/form checks + rep buffers | A full set can be counted locally and summarized without cloud |
| **W4** | Post-set DTW report integration | Finish Set can submit rep sequences and merge a DTW report when available |
| **W5** | Slim UI + Demo Mode + offline queue for summaries | iPad Demo Mode smooth; offline-recovery replay of summaries works |
| **W6** | iPad fit + on-site tuning + dry runs | Both booths' UIs work + 8-hour stability |

**Total estimate**: ~80 h (part-time, 12–15 h/week)

---

## §13 Risks (Frontend Perspective)

| Risk | Mitigation |
|-----|------|
| MediaPipe < 15 FPS on mid-range Android | Drop to `pose_landmarker_lite` + GPU delegate; worst-case fall back to MoveNet Lightning |
| iPad Safari Canvas perf drop | Disable extras; throttle `requestAnimationFrame` for Demo Mode |
| `worldLandmarks` unstable in extreme side angles | UI guidance: "adjust camera so full body is visible" |
| 14-angle formula drifts from server | **Shared fixtures + CI** keeps both sides honest |
| WebSocket weak-network drops | Reconnect + offline queue; realtime frames discard |

---

## §14 Extension Placeholders (post-Demo)

- **Hand Landmarker**: not in v0.3; fine-grained gestures (e.g. heart shape) for future
- **Multi-language UI**: i18n is wired (`react-i18next`); add language packs after Demo
- **Personalized thresholds**: tune local thresholds after collecting user's 3 baseline reps; not for Demo

### Trajectory Replay (post-W5, requires contract change)

**What it is**: After a set ends, show a side-by-side or dual-color skeleton overlay comparing the user's actual rep motion vs. the standard template. Problem joints pulse in a different color. The user can scrub through the rep to see exactly where the deviation occurred.

**Why it's valuable**: DTW feedback is abstract ("knee valgus, severity 0.7"). Watching the replay makes it concrete — the user sees their skeleton diverge from the template in real time.

**What it needs** (changes from current v0.3 baseline):

| Component | Current | Required for Replay |
| --- | --- | --- |
| Client recording | `joint_angles[14]` per frame | + `world_landmarks[33]` per frame buffered in memory |
| `client.action_submit` | angles only | + `world_landmarks` per frame (see [04 §3.5](./04_Interface_Contracts.md#35-clientaction_submit--completed-action-sequence-post-set-dtw-report)) |
| Server DB `actions` table | `joint_angles_compressed` | + `world_landmarks_compressed` (see [04 §8](./04_Interface_Contracts.md#8-database-schema-contract-server-internal-but-client-needs-to-know)) |
| History API | not implemented | `GET /api/history/{action_id}` returns angles + landmarks |
| Client render | Canvas 2D skeleton | Procrustes-align template → dual-color scrubable animation |

**System load analysis**:

| Aspect | Impact | Notes |
| --- | --- | --- |
| Client memory | +~16 KB per rep in JS heap | 30 frames × 33 landmarks × 4 floats × 4 bytes; buffer only while recording, flush to IndexedDB after POST |
| POST payload | ~50–80 KB per rep (gzip) vs ~1 KB today | One-time POST at rep end, not streaming; acceptable on local WiFi |
| Server storage | ~800 B/rep compressed (vs ~300 B today) | ×3 storage per rep, still negligible at demo scale (<100 users) |
| Server CPU | None | Replay is pure client-side Canvas animation; server just stores and returns the blob |
| Cloud bandwidth (results page) | +~80 KB per replay fetch | Acceptable; only triggered on user intent |

**Conclusion**: System load is negligible at demo scale. The only real cost is the storage policy change (see privacy note below).

**Privacy consideration**: `worldLandmarks` coordinates are pelvis-origin, meter-scale body geometry — NOT absolute spatial positions, NOT tied to location or identity. The current [04 §8](./04_Interface_Contracts.md#8-database-schema-contract-server-internal-but-client-needs-to-know) privacy rule prohibits "absolute world_landmarks" as shorthand for raw tracking data. Replay requires a **scoped exception**: per-rep worldLandmarks (body geometry only, retained for replay, not for external processing). This needs 3-way review and a 04 contract update before implementation.

---

## §15 Contract Quick-Reference

| What you need | Jump to |
|---------|------|
| 14 joint-angle indices/formulas | [04 §5](./04_Interface_Contracts.md#5-14-d-joint-angle-definitions) |
| Action submission messages | [04 §3.5](./04_Interface_Contracts.md#35-clientaction_submit--completed-action-sequence-post-set-dtw-report) |
| Report / summary messages | [04 §4](./04_Interface_Contracts.md#4-cloud--phone-summaryreport-responses-ws-reserved) |
| WiFi QR string generation | [04 §2.1](./04_Interface_Contracts.md#21-wifi-qr-string-format-phone--esp32-one-shot-pairing) |
| ESP32 `/hello` fields | [04 §2.3](./04_Interface_Contracts.md#23-http-handshake-hello) |
| Error code handling | [04 §6.1](./04_Interface_Contracts.md#61-error-codes-servererrorcode) |

---

*Last updated: 2026-04-24*
