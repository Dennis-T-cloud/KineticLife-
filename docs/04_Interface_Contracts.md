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
│          │  ③ HTTP /stream (MJPEG)           │         │
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

**Format**: industry-standard WiFi QR string

```
WIFI:S:<SSID>;T:<TYPE>;P:<PASSWORD>;;
```

**Fields**:

| Field | Required | Value | Notes |
|-----|------|---|------|
| `S` | yes | string | Phone hotspot SSID. `;` `:` `,` `\` must be backslash-escaped |
| `T` | yes | `WPA` / `WEP` / `nopass` | Encryption type |
| `P` | omit if `T=nopass` | string | Password |

**Example**:
```
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
  "cam_model": "OV2640",
  "supported_resolutions": ["160x120@20", "240x240@15", "320x240@10"],
  "default_resolution": "240x240@15",
  "uptime_s": 42,
  "free_psram_kb": 2048
}
```

`board_model` is the v0.3 calibration baseline and should remain exactly `"Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B"` unless the connected hardware is intentionally different.

**Errors**: connection failure → Web shows "device not found"; any non-200 = pairing incomplete.

### 2.4 MJPEG stream `/stream`

**Request**: `GET http://fitcam-<mac6>.local/stream?res=240x240@15`

`res` is optional (defaults to `default_resolution`). Invalid value → 400.

**Response**: `200 OK`

```
Content-Type: multipart/x-mixed-replace; boundary=frame
```

**Per-frame envelope**:

```
--frame\r\n
Content-Type: image/jpeg\r\n
Content-Length: <N>\r\n
X-Frame-Id: <uint32>\r\n
X-Timestamp-Ms: <int64>\r\n
\r\n
<JPEG bytes, N bytes>\r\n
```

**Constraints**:
- `X-Frame-Id` monotonic; resets to 0 on ESP32 reboot
- `X-Timestamp-Ms` = ESP32 local clock in epoch ms (NTP-synced; before sync may be relative-to-boot, Web calibrates via `/hello.uptime_s`)
- Max JPEG size 128 KB (drops oversized frames)
- ESP32 stops encoding after 5 s of no client read (power saving)

### 2.5 `/ctrl` parameter adjustment (placeholder, not in v0.3)

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
  "tsd_ms": 1745520012500,
  "frames": [
    {
      "frame_id": 1234,
      "ts_ms": 1745520010000,
      "joint_angles": [158.2, "..."]
    },
    "... 25–60 frames"
  ]
}
```

> Each frame carries only `joint_angles` (14 dims), not the full 33 keypoints — sufficient for DTW and 10× cheaper bandwidth.

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
| `gesture_events` | `gesture` | enum | `client.gesture` |
| `advice_tips` | `markdown` | text | `server.advice_tip` |

**Privacy contract**: NO table may store raw video or absolute `world_landmarks` x/y/z. Only:
- 14-D `joint_angles` (already view-invariant and de-identified)
- Derived labels (correct, problem_joints, completeness)

---

## §9 Versioning Rules

1. **Adding a field** = compatible, no `v` bump. New fields must be optional; receivers must ignore unknown fields without erroring.
2. **Removing a field / changing semantics** = breaking, **bump `v`**. Both sides negotiate the highest mutually supported `v` at `client.hello`.
3. **§5 joint angle changes** = bump `joint_angles_version` (independent from `v`).
4. **Change process**: PR this doc → 3-way review → merge → propagate to role docs.

---

*Last updated: 2026-04-24 · Maintained jointly by all 3 engineers*
