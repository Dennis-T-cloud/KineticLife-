# 04 · Interface Contracts

> **Version**: v0.3 · **Status**: Single source of truth (read by all 3 roles)
> **Audience**: IoT / Frontend / Backend — **all required**
> **Change rule**: Any field change must be PR'd here first, reviewed by all 3, then propagated to role docs

---

## §1 General

### 1.1 Why this document exists

The project spans 3 platforms (ESP32 C++ / Web TypeScript / Python) with **4 transport interfaces**. Any misalignment explodes at integration time. This contract is **the joint commitment of all 3 engineers**.

Role docs (01/02/03) **do not redefine any format** — they only reference this document.

### 1.2 Protocol overview

```
┌──────────┐  ① WiFi QR (one-shot)            ┌─────────┐
│  Phone   │  ───────────────────────>         │ ESP32-S3│
│   Web    │  ② HTTP /hello (handshake)        │         │
│          │  <───────────────────────         │         │
│          │  ③ WebSocket /ws (binary JPEG)    │         │
│          │  <═══════════════════════         │         │
└────┬─────┘                                    └─────────┘
     │ ④ WebSocket JSON (bidirectional)
     ↓
┌──────────┐
│  Cloud   │
└──────────┘
```

### 1.3 Global conventions

| Item | Rule |
|---|------|
| **Endianness** | All binary little-endian |
| **Encoding** | UTF-8 |
| **Timestamps** | `ts_ms` = UTC epoch ms, int64; `frame_id` = monotonic uint32 starting from ESP32 boot |
| **WebSocket protocol version** | Every message MUST carry `"v": 1`; only **backwards-compatible additions** allowed (new fields must be optional); breaking changes bump to `v: 2` and are negotiated at `client.hello` |
| **ID generation** | `session_id` / `user_id` = UUIDv4 string; `device_id` = ESP32 MAC last 6 bytes hex |
| **Coordinate units** | 3D world landmarks = meters; image landmarks = normalized [0, 1] |
| **Numeric precision** | Landmark coords 4 decimals; angles 1 decimal; confidence 2 decimals |

---

## §2 ESP32 ↔ Phone (local WiFi)

### 2.1 WiFi QR string format (Phone → ESP32, one-shot pairing)

**Primary format**: compact KineticLife v1 WiFi QR string, optimized for reliable ESP32 camera decoding.

```
K1:<TYPE_CODE>:<SSID_LEN>:<SSID><PASSWORD>
```

`TYPE_CODE` values: `W` = WPA/WPA2, `E` = WEP, `N` = no password.

**Compatibility format**: firmware also accepts the industry-standard WiFi QR string.

```
WIFI:S:<SSID>;T:<TYPE>;P:<PASSWORD>;;
```

**Fields**:

| Field | Required | Value | Notes |
|-----|------|---|------|
| `S` | yes | string | Phone hotspot SSID. `;` `:` `,` `\` must be backslash-escaped |
| `T` | yes | `WPA` / `WEP` / `nopass` | Encryption type |
| `P` | omit if `T=nopass` | string | Password |

**Examples**:
```
K1:W:13:DennisPhone5Gmy_pass_123
WIFI:S:DennisPhone-5G;T:WPA;P:my_pass_123;;
```

**Constraints**:
- SSID **must not contain spaces** (the spec allows them, but some phone hotspots break)
- Phone hotspot **must be 2.4 GHz** (ESP32-S3 doesn't support 5 GHz)
- Web must show this constraint to the user before generating the QR

### 2.2 mDNS discovery

After joining WiFi, ESP32 broadcasts:

```
fitcam-<mac6>.local
```

where `<mac6>` = lowercase hex of last 6 bytes of MAC (e.g. `a1b2c3`).

Web tries to resolve on launch; falls back to manual IP entry on failure.

### 2.3 HTTP handshake `/hello`

**Request**: `GET http://fitcam-<mac6>.local/hello`
**Timeout**: 2 s

**Response**: `200 OK`, `Content-Type: application/json`

```json
{
  "v": 1,
  "device_id": "a1b2c3",
  "fw_version": "0.3.0",
  "mac": "aa:bb:cc:a1:b2:c3",
  "board_model": "Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B",
  "cam_model": "OV5640",
  "state": "ready",
  "supported_resolutions": ["160x120@20", "240x240@15", "320x240@10"],
  "default_resolution": "240x240@15",
  "uptime_s": 42,
  "free_psram_kb": 2048
}
```

`board_model` is the v0.3 calibration baseline and should remain exactly `"Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B"` unless the connected hardware is intentionally different.

**Errors**: connection failure → Web shows "device not found"; any non-200 = pairing incomplete.

### 2.4 HTTP status `/status`

**Request**: `GET http://fitcam-<mac6>.local/status`
**Timeout**: 2 s

**Response**: `200 OK`, `Content-Type: application/json`

```json
{
  "state": "ready",
  "device_id": "a1b2c3",
  "fw_version": "0.3.0",
  "board_model": "Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B",
  "cam_model": "OV5640",
  "camera_mode": "stream",
  "pixel_format": "JPEG",
  "frame_size": "240x240",
  "jpeg_quality": 12,
  "ip": "192.168.1.23",
  "rssi_dbm": -42,
  "wifi_status": 3,
  "stream_count": 1,
  "uptime_s": 42,
  "free_heap_kb": 240,
  "free_psram_kb": 2048
}
```

`state` values: `boot`, `pairing`, `connecting`, `ready`, `streaming`, `error`, `fatal`.

### 2.5 WebSocket stream `/ws`

**Endpoint**: `ws://fitcam-<mac6>.local/ws`

**Transport**: Binary WebSocket. Each WebSocket message is one complete JPEG frame (raw JPEG bytes, no wrapper). `ws.binaryAll()` is non-blocking — copies to internal queue immediately; ESP32 returns the camera framebuffer right after.

**Before connecting**, client should apply camera settings:

```
GET http://fitcam-<mac6>.local/cam?res=320x240&q=12&brightness=0&contrast=1&saturation=0&sharpness=1&ae_level=0
```

**Constraints**:
- Each binary message = one complete JPEG; client decodes with `createImageBitmap()` or `URL.createObjectURL()`
- Frame rate ≈ 9 FPS at QVGA JPEG (OV5640 hardware limit, `cap_avg_ms ≈ 106 ms`)
- Max JPEG size 256 KB (frames exceeding this are dropped by firmware)
- Client must implement backpressure: only decode one frame at a time; drop intermediate frames if decode is in progress
- ESP32 calls `ws.cleanupClients()` every loop tick to reclaim closed-connection memory

### 2.6 End session `/end`

**Request**: `POST http://fitcam-<mac6>.local/end`

**Response**: `200 OK`, `Content-Type: application/json`

```json
{
  "ok": true,
  "action": "clear_wifi_and_reboot"
}
```

ESP32 clears the temporary WiFi session in NVS and reboots into QR pairing mode. Web should navigate back to `pair.html` after calling this endpoint.

### 2.7 `/ctrl` parameter adjustment (placeholder, not in v0.3)

`POST /ctrl` body `{"brightness": 0.6}` etc. **Reserved, not implemented**.

---

## §3 Phone → Cloud (WebSocket upstream)

**URL**: `wss://api.kineticlife.app/ws?token=<jwt>`
**Subprotocol**: `kineticlife.v1`
**Heartbeat**: client sends `{"type":"ping"}` every 20 s; server replies `{"type":"pong"}`

### 3.1 `client.hello` — session init (first message after connect)

```json
{
  "v": 1,
  "type": "client.hello",
  "session_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "user_id": "anon-a1b2c3",
  "mode": "jumpin",
  "action_hint": null,
  "device_id": "a1b2c3",
  "client_ts_ms": 1745520000000,
  "client_capabilities": {
    "mediapipe_version": "0.10.14",
    "has_world_landmarks": true,
    "joint_angles_version": 1
  }
}
```

| Field | Type | Notes |
|-----|------|------|
| `session_id` | UUIDv4 | Unique ID for this training session |
| `user_id` | string / null | Logged-in user ID; in Jump-in anonymous mode = `"anon-<deviceId>"` |
| `mode` | `"jumpin"` / `"duolingo"` / `"demo"` | Entry mode |
| `action_hint` | string / null | Expected action in Duolingo (`"squat"` etc.); `null` for Jump-in |
| `client_capabilities.joint_angles_version` | int | Version from §5; consistency check between client and server algorithms |

**Server response**: `server.ack` (see §4.1)

### 3.2 `client.keypoints` — realtime keypoints (high-frequency main path)

```json
{
  "v": 1,
  "type": "client.keypoints",
  "session_id": "f47ac10b-...",
  "frame_id": 1234,
  "ts_ms": 1745520001500,
  "world_landmarks": [
    [0.0123, -0.4521, 0.0987, 0.98],
    "... 33 × [x, y, z, visibility]"
  ],
  "joint_angles": [
    158.2, 162.5, 91.3, 89.7, 174.2, 172.8,
    165.0, 164.3, 175.0, 176.1, 178.5, 177.2, 10.2, 8.5
  ],
  "classifier_hint": null
}
```

| Field | Type | Notes |
|-----|------|------|
| `world_landmarks` | `[33][4]` float | 3D world coords (x,y,z meters) + visibility [0,1] |
| `joint_angles` | `[14]` float | See §5; degrees, range [0, 180] |
| `classifier_hint` | string / null | Edge coarse hint (e.g. `"suspect_knee_valgus"`); nullable |

**Send rate**: 10–15 Hz (matches MJPEG; client may downsample)

**Server response**: `server.feedback` (see §4.2). Server may batch (not every frame gets a response).

### 3.3 `client.gesture` — gesture event

```json
{
  "v": 1,
  "type": "client.gesture",
  "session_id": "f47ac10b-...",
  "ts_ms": 1745520005000,
  "gesture": "start",
  "hold_ms": 1500
}
```

`gesture` enum: `"start"` / `"end_set"` / `"pause"` / `"resume"` / `"calibrate"` / `"toggle"`

### 3.4 `client.set_control` — manual fallback (lowest-priority UX)

```json
{
  "v": 1,
  "type": "client.set_control",
  "session_id": "f47ac10b-...",
  "ts_ms": 1745520030000,
  "action": "start"
}
```

`action` enum: `"start"` / `"end"`

### 3.5 `client.action_submit` — full action sequence (Duolingo)

In Duolingo mode, after edge detects a complete rep, the client submits the full sequence for server-side fine DTW:

```json
{
  "v": 1,
  "type": "client.action_submit",
  "session_id": "f47ac10b-...",
  "action_id": "act-2025-4-24-00012",
  "exercise_hint": "squat",
  "ts_start_ms": 1745520010000,
  "ts_end_ms": 1745520012500,
  "frames": [
    {
      "frame_id": 1234,
      "ts_ms": 1745520010000,
      "joint_angles": [158.2, 162.5, "..."],
      "world_landmarks": [
        [0.0123, -0.4521, 0.0987, 0.98],
        "... 33 × [x, y, z, visibility]"
      ]
    },
    "... 25–60 frames"
  ]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `frames[].joint_angles` | yes | 14 dims; see §5 |
| `frames[].world_landmarks` | **optional** | `[33][4]` floats `[x, y, z, visibility]`; pelvis-origin meters; included when client supports replay (see §9) |

> `world_landmarks` is omitted by default and only included when the client opts in for replay recording. DTW and classification use only `joint_angles`. The server stores `world_landmarks` separately and never uses them for scoring.

**Replay opt-in**: client signals intent by setting `"replay": true` in `client.hello.client_capabilities` (additive field, ignored by servers that don't support it).

---

## §4 Cloud → Phone (WebSocket downstream)

### 4.1 `server.ack` — handshake confirm

```json
{
  "v": 1,
  "type": "server.ack",
  "session_id": "f47ac10b-...",
  "server_ts_ms": 1745520000123,
  "server_version": "0.3.0",
  "negotiated_v": 1,
  "templates_available": ["squat", "pushup", "plank"]
}
```

### 4.2 `server.feedback` — main-path feedback (critical)

```json
{
  "v": 1,
  "type": "server.feedback",
  "session_id": "f47ac10b-...",
  "for_frame_id": 1234,
  "server_ts_ms": 1745520001700,
  "correct": false,
  "classified_as": "squat",
  "classifier_confidence": 0.92,
  "problem_joints": [
    {"joint": "left_knee", "severity": 0.72, "issue": "valgus"},
    {"joint": "lumbar", "severity": 0.41, "issue": "rounded"}
  ],
  "completeness": 0.68,
  "dtw_distance": 3.42,
  "dtw_threshold": 2.10,
  "reference_template_id": "squat_standard_v2"
}
```

| Field | Type | Notes |
|-----|------|------|
| `for_frame_id` | uint32 | The `client.keypoints.frame_id` this feedback addresses (may lag by a few frames) |
| `correct` | bool | Overall correctness |
| `problem_joints[].joint` | string | English joint name from §5 |
| `problem_joints[].severity` | [0,1] | Higher = more wrong |
| `problem_joints[].issue` | string | Issue enum, see §6.2 |
| `completeness` | [0,1] | Range-of-motion completion |
| `dtw_distance` | float | Distance to template |

### 4.3 `server.set_event` — auto-set detection events

```json
{
  "v": 1,
  "type": "server.set_event",
  "session_id": "f47ac10b-...",
  "ts_ms": 1745520040000,
  "event": "rep_detected",
  "rep_index": 8,
  "set_index": 1
}
```

`event` enum: `"set_start"` / `"rep_detected"` / `"rest_started"` / `"set_end"`

For `"set_end"`, an additional `summary` is included:
```json
{
  "summary": {
    "rep_count": 12,
    "correct_count": 9,
    "avg_completeness": 0.82,
    "duration_s": 38.5
  }
}
```

### 4.4 `server.advice_tip` — async coaching advice (off main path)

```json
{
  "v": 1,
  "type": "server.advice_tip",
  "session_id": "f47ac10b-...",
  "scope": "set_end",
  "markdown": "Set complete at 85%. Knee valgus is half of last week — keep going!",
  "generated_at_ms": 1745520041000,
  "model": "claude-haiku"
}
```

`scope` enum: `"login"` / `"set_end"` / `"day_end"` / `"consecutive_fail"`

### 4.5 `server.error` — error notification

```json
{
  "v": 1,
  "type": "server.error",
  "session_id": "f47ac10b-...",
  "code": "classifier_reject",
  "message": "Action not recognized. Hold T-pose for 2s to recalibrate.",
  "recoverable": true
}
```

Error codes in §6.1.

---

## §5 14-D Joint Angle Definitions

> **Version**: `joint_angles_version = 1`. Client and server algorithms must match exactly. Any algorithmic change → bump this version → check at `client.hello`.

**Index rule**: array indices 0–13, fixed order.

| Idx | Name | Calculation (vector angle) | Range (°) |
|-----|------|---------------------------|---------|
| 0 | `left_knee` | angle(L_HIP→L_KNEE, L_KNEE→L_ANKLE) | [0, 180] |
| 1 | `right_knee` | angle(R_HIP→R_KNEE, R_KNEE→R_ANKLE) | [0, 180] |
| 2 | `left_elbow` | angle(L_SHOULDER→L_ELBOW, L_ELBOW→L_WRIST) | [0, 180] |
| 3 | `right_elbow` | angle(R_SHOULDER→R_ELBOW, R_ELBOW→R_WRIST) | [0, 180] |
| 4 | `left_hip` | angle(L_SHOULDER→L_HIP, L_HIP→L_KNEE) | [0, 180] |
| 5 | `right_hip` | angle(R_SHOULDER→R_HIP, R_HIP→R_KNEE) | [0, 180] |
| 6 | `left_shoulder` | angle(L_HIP→L_SHOULDER, L_SHOULDER→L_ELBOW) | [0, 180] |
| 7 | `right_shoulder` | angle(R_HIP→R_SHOULDER, R_SHOULDER→R_ELBOW) | [0, 180] |
| 8 | `left_ankle` | angle(L_KNEE→L_ANKLE, L_ANKLE→L_FOOT_INDEX) | [0, 180] |
| 9 | `right_ankle` | angle(R_KNEE→R_ANKLE, R_ANKLE→R_FOOT_INDEX) | [0, 180] |
| 10 | `left_wrist` | angle(L_ELBOW→L_WRIST, L_WRIST→L_INDEX) | [0, 180] |
| 11 | `right_wrist` | angle(R_ELBOW→R_WRIST, R_WRIST→R_INDEX) | [0, 180] |
| 12 | `trunk_lean` | angle(MID_HIP→MID_SHOULDER, world_up=[0,-1,0]) | [0, 90] |
| 13 | `pelvis_tilt` | angle(L_HIP→R_HIP, world_horizontal) | [0, 45] |

**`MID_HIP` / `MID_SHOULDER`** = arithmetic mean of left/right counterparts.

**MediaPipe landmark indices** (for implementation):
- L_HIP = 23, R_HIP = 24, L_KNEE = 25, R_KNEE = 26, L_ANKLE = 27, R_ANKLE = 28
- L_SHOULDER = 11, R_SHOULDER = 12, L_ELBOW = 13, R_ELBOW = 14, L_WRIST = 15, R_WRIST = 16
- L_FOOT_INDEX = 31, R_FOOT_INDEX = 32, L_INDEX = 19, R_INDEX = 20

**Formula** (reference, JS/Python must match):

```
angle(v1, v2) = degrees(arccos(dot(v1, v2) / (|v1| × |v2|)))
```

**Low-confidence handling**:
- If any related landmark has `visibility < 0.3`, the angle = `NaN`
- On the wire, `NaN` is encoded as JSON `null`

---

## §6 Error & Issue Codes

### 6.1 Error codes (`server.error.code`)

| Code | Meaning | recoverable |
|------|------|-------------|
| `auth_failed` | JWT invalid | false |
| `bad_message` | malformed JSON | true |
| `version_mismatch` | protocol version incompatible | false |
| `joint_angles_version_mismatch` | §5 version mismatch | false |
| `classifier_reject` | classifier can't recognize action | true |
| `low_visibility` | keypoint confidence too low | true |
| `template_not_found` | no matching template | true |
| `rate_limit` | upstream too fast | true |
| `internal_error` | server exception | true |

### 6.2 Problem joint codes (`problem_joints[].issue`)

| Code | Meaning | Applicable joints |
|------|------|---------|
| `valgus` | inward collapse | knee, elbow |
| `varus` | outward bow | knee |
| `rounded` | rounded back | lumbar, trunk |
| `hyperextended` | over-extended | knee, elbow, lumbar |
| `insufficient_depth` | not deep enough | hip, knee |
| `excessive_lean` | leaning too far forward | trunk |
| `asymmetric` | left-right asymmetric | knee, hip, shoulder |

New issue codes must be registered here AND bump §5 version.

---

## §7 Minimum Round-trip Example (for joint integration testing)

A complete Duolingo squat session (2 reps):

```
[Web] WS open → wss://api/.../ws?token=jwt_xxx
[Web] → client.hello {mode: "duolingo", action_hint: "squat"}
[Cloud] → server.ack {templates_available: ["squat", "pushup", "plank"]}
[Web] → client.gesture {gesture: "start", hold_ms: 1500}
[Cloud] → server.set_event {event: "set_start"}

(user starts squatting, 30 frames)
[Web] → client.keypoints {frame_id: 1, ts: T+0,    joint_angles: [...]}
[Web] → client.keypoints {frame_id: 2, ts: T+100,  ...}
...
[Web] → client.keypoints {frame_id: 30, ts: T+3000, ...}

[Cloud] → server.feedback {for_frame_id: 8,  correct: true,  completeness: 0.85}
[Cloud] → server.feedback {for_frame_id: 25, correct: false, problem_joints: [...]}
[Cloud] → server.set_event {event: "rep_detected", rep_index: 1}

(rep 2, 30 frames, omitted)

[Cloud] → server.set_event {event: "rep_detected", rep_index: 2}
[Web] → client.gesture {gesture: "end_set"}
[Cloud] → server.set_event {
  event: "set_end",
  summary: {rep_count: 2, correct_count: 1, avg_completeness: 0.78}
}
[Cloud] → server.advice_tip {scope: "set_end", markdown: "..."}
```

**Integration test**: all 3 engineers must run this end-to-end on the W3 milestone scaffolding. Once all messages are exchanged successfully, contract alignment is considered verified.

---

## §8 Database Schema Contract (server-internal, but client needs to know)

Actual Postgres tables live in `03_Cloud_DTW.md`. This section only enumerates **fields whose semantics must align across client and server**.

| Table | Field | Type | Source |
|---|------|------|-----|
| `sessions` | `session_id` | UUID | `client.hello` |
| | `user_id` | UUID / null | `client.hello` |
| | `mode` | enum | `client.hello` |
| | `started_at` | timestamptz | server on hello |
| `actions` | `action_id` | string | `client.action_submit` |
| | `session_id` | UUID FK | |
| | `exercise` | string | classifier output |
| | `correct` | bool | DTW output |
| | `dtw_distance` | float | |
| | `joint_angles_compressed` | bytea | gzip of `joint_angles` series |
| | `world_landmarks_compressed` | bytea / null | gzip of `world_landmarks` series; **null unless client sent replay opt-in**; see privacy note below |
| `gesture_events` | `gesture` | enum | `client.gesture` |
| `advice_tips` | `markdown` | text | `server.advice_tip` |

**Privacy contract**: NO table may store raw video or raw `image_landmarks`. Only:

- 14-D `joint_angles` (view-invariant, de-identified) — always stored
- Derived labels (`correct`, `problem_joints`, `completeness`) — always stored
- `world_landmarks` (pelvis-origin body geometry, NOT absolute spatial position, NOT tied to location or identity) — **stored only when client explicitly opts in for replay** (`client.hello.client_capabilities.replay: true`); retained per-rep for replay playback only; never used for scoring or external processing

> **Why worldLandmarks are permitted for replay**: MediaPipe `worldLandmarks` use the pelvis midpoint as origin (meter-scale body geometry). They encode body shape/pose, not spatial location. This is meaningfully different from GPS or camera-position data. The scoped exception applies only to replay-enabled sessions and is always nullable.

---

## §9 Versioning Rules

1. **Adding a field** = compatible, no `v` bump. New fields must be optional; receivers must ignore unknown fields without erroring.
2. **Removing a field / changing semantics** = breaking, **bump `v`**. Both sides negotiate the highest mutually supported `v` at `client.hello`.
3. **§5 joint angle changes** = bump `joint_angles_version` (independent from `v`).
4. **Change process**: PR this doc → 3-way review → merge → propagate to role docs.

---

## §10 Demo Mode — Real-time Heuristic Feedback (`web/demo.html`)

> **Status**: implemented in `web/demo.html` (standalone page, no server dependency).
> **Purpose**: Demo Day prototype demonstrating real-time form feedback and rep counting.
> This page replaces the planned replay/ghost-skeleton flow (rolled back 2026-05-01).

### 10.1 Architecture

```
ESP32 /ws (binary JPEG, 320×240 landscape)
       → WebSocket → createImageBitmap() → latestBitmap
       → rotate 90° CW → inferCanvas (120×160 portrait)
       → MediaPipe PoseLandmarker.detectForVideo(inferCanvas)
       → result.landmarks[0]  (image-normalized coords)
       → calcAngle()          (Kaggle arctan2 method, 2D)
       → threshold checks     → colored skeleton overlay
       → state machine        → rep counter
       [on "Finish Set"] → in-browser summary card
```

**Camera source**: ESP32 WebSocket stream only. No local webcam.
If no `?cam=` URL parameter and no `kineticlife.camUrl` in localStorage, page shows error badge and stays black (MediaPipe is not loaded).

**Entry point**: `pair.html` → "Demo Mode" button → `demo.html?cam=<url>`.

No server calls during recording. Data stays entirely in the browser.

### 10.1.1 WebSocket stream handling

Identical pattern to `debug.html`. One decode in flight at a time; newest frame wins when a second arrives during decoding (no latency creep). Auto-reconnects every 2 s on close.

```text
Binary JPEG ArrayBuffer
  → createImageBitmap(Blob)  [async, GPU-accelerated]
  → latestBitmap (ImageBitmap, previous released via .close())
```

### 10.2 Angle calculation — Kaggle arctan2 method (JS)

```js
function calcAngle(a, b, c) {
  // a, b, c = MediaPipe landmark objects { x, y, visibility }
  // b = vertex joint
  const rad = Math.atan2(c.y - b.y, c.x - b.x)
            - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs(rad * 180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return Math.round(deg);
}
```

Uses **image-space 2D coords** (`result.landmarks[0]`), not world landmarks.
This differs from `debug.html`'s `computeAngles()` which uses 3D world landmarks.

### 10.3 Exercises and key parameters

| Exercise | Key landmark triplet (vertex = middle) | Rest condition | Work condition |
|---|---|---|---|
| Bodyweight Squat | hip→knee→ankle (both sides, avg) | avg > 160° | avg < 100° |
| Dumbbell Curl (Right Arm) | shoulder→elbow→wrist (right) | angle > 155° | angle < 55° |
| Dumbbell Lateral Raise | hip→shoulder→elbow (both sides, avg) | avg < 30° | avg > 75° |

Rep counted when state transitions: `neutral → rest → work → rest`.

### 10.4 Form checks per exercise

#### Bodyweight Squat

| Check | Condition (fail = red) | Hint |
| --- | --- | --- |
| Left depth | During work: knee angle ≥ 110° | Squat lower on the left |
| Right depth | During work: knee angle ≥ 110° | Squat lower on the right |
| Symmetry | `\|left − right\|` ≥ 20° at any time | Uneven leg drive |

#### Dumbbell Curl (Right Arm)

| Check | Condition (fail = red) | Hint |
| --- | --- | --- |
| Curl range | During work: elbow angle ≥ 60° | Curl higher |
| Elbow height | `elbow.y − shoulder.y < −0.05` (elbow above shoulder) | Do not lift your elbow |

#### Dumbbell Lateral Raise

| Check | Condition (fail = red) | Hint |
| --- | --- | --- |
| Right height | During work: shoulder abduction ≤ 70° | Raise your right arm to shoulder height |
| Left height | During work: shoulder abduction ≤ 70° | Raise your left arm to shoulder height |
| Elbow lock (R) | During work: elbow angle ≥ 165° | Keep your right elbow slightly bent; do not lock it |
| Symmetry | `\|right − left\|` ≥ 25° at any time | Arm heights do not match |

### 10.5 Canvas rendering spec

| Element | Style |
| --- | --- |
| Background | `#000000` + `rgba(0,0,0,0.38)` video overlay |
| Skeleton — correct | stroke `#DEFF9A`, lineWidth 6 |
| Skeleton — error | stroke `#FF5555`, lineWidth 8 |
| Skeleton — low visibility | stroke `rgba(255,255,255,0.45)`, lineWidth 2, alpha 0.4 |
| Joint dots | radius 5px, same color as connected bones |
| Head center anchor | nose (lm[0]); hollow circle radius 8, fill `rgba(255,255,255,0.22)`, stroke `rgba(255,255,255,0.65)` lineWidth 2; drawn only when visibility ≥ 0.5; reserved for head-motion features |
| Angle annotation | white text drawn on canvas near vertex joint |

### 10.6 Post-set summary (in-browser only)

Triggered by "Finish Set" button. Displays:

- Total rep count
- Session duration (seconds)
- Accuracy = `(totalFrames − errorFrames) / totalFrames × 100%`
- Top 3 most frequent form errors (sorted by frame count, with relative frequency bar)

No DTW. No server call. Summary resets on "Restart".

---

Last updated: 2026-05-02 (head center anchor added to §10.5; WS target display added to debug.html) · Maintained jointly by all 3 engineers
