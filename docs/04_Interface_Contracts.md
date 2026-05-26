# 04 - Interface Contracts

> Last updated: 2026-05-26
> Status: source of truth for current cross-layer payloads

Any field or semantic change that crosses firmware, web, and server boundaries must be documented here first.

---

## 1. Conventions

| Item | Rule |
| --- | --- |
| JSON encoding | UTF-8 |
| Binary camera frames | raw JPEG bytes |
| Timestamps | `ts_ms` is epoch milliseconds unless noted |
| Frame ids | monotonically increasing within the local stream/action |
| Protocol version | cloud action submissions use `v: 1` |
| Joint angle count | exactly 14 values |
| Missing angle | JSON `null` |
| Device id | MAC last 3 bytes as lowercase hex |

---

## 2. Firmware BLE Contract

### 2.1 BLE Advertised Name

```text
KineticLife-BLE-<mac6>
```

### 2.2 GATT UUIDs

| Item | UUID | Direction |
| --- | --- | --- |
| Service | `9b8f0001-6f4d-4d4f-9c9a-4b4c49464501` | discover |
| TX notify | `9b8f0002-6f4d-4d4f-9c9a-4b4c49464501` | ESP32 to browser |
| RX control | `9b8f0003-6f4d-4d4f-9c9a-4b4c49464501` | browser to ESP32 |

### 2.3 RX Commands

Commands are UTF-8 text:

```text
mode=wifi
mode=ble
size=<8..180>
gap=<4..100>
start=<1000..60000>
cam=<0..60000>
stop
```

`cam=0` means stream camera snapshots until disconnect or `stop`.

### 2.4 Camera Snapshot Notifications

Frame metadata notification:

```text
CAM:<frame_id>:<bytes>:<chunks>:<size>:<q>
```

Then raw JPEG chunks are sent until `<bytes>` have been received. The browser reconstructs a Blob/ImageBitmap from those chunks.

---

## 3. Firmware WiFi Contract

### 3.1 Pairing QR

Compact KineticLife payload:

```text
K1:<TYPE_CODE>:<SSID_LEN>:<SSID><PASSWORD>
```

`TYPE_CODE`:

| Code | Meaning |
| --- | --- |
| `W` | WPA/WPA2 |
| `E` | WEP |
| `N` | no password |

Compatibility payload:

```text
WIFI:S:<SSID>;T:<TYPE>;P:<PASSWORD>;;
```

### 3.2 Preset-Network Soft AP

When WiFi mode has no active session, firmware starts:

```text
SSID: KineticLife-Setup
Password: kineticlife
Base URL: http://192.168.4.1
```

Endpoints:

| Endpoint | Response |
| --- | --- |
| `/config-networks` | array of `{ssid, auth}` from local firmware config |
| `/try-config?idx=N` | `{ok, ssid}` or `{ok:false,error}` |
| `/config-status` | `{state,msg}` where state is `idle`, `connecting`, `connected`, or `failed` |

### 3.3 mDNS

After WiFi connection:

```text
http://fitcam-<mac6>.local
```

### 3.4 `GET /hello`

Current firmware response:

```json
{
  "v": 1,
  "device_id": "d37d7c",
  "fw_version": "0.3.0",
  "mac": "80:b5:4e:d3:7d:7c",
  "board_model": "Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B",
  "cam_model": "OV2640 140deg wide-angle",
  "state": "ready",
  "ws_clients": 0,
  "uptime_s": 42,
  "free_psram_kb": 8144,
  "ws_token": "a1b2c3d4"
}
```

Clients must treat `ws_token` as required for WiFi WebSocket streaming.

### 3.5 `GET /status`

Current firmware response includes:

```json
{
  "state": "ready",
  "device_id": "d37d7c",
  "fw_version": "0.3.0",
  "cam_model": "OV2640 140deg wide-angle",
  "camera_mode": "stream",
  "pixel_format": "JPEG",
  "frame_size": "320x240",
  "jpeg_quality": 12,
  "ip": "192.168.1.23",
  "rssi_dbm": -55,
  "wifi_quality": 90,
  "wifi_channel": 6,
  "wifi_bssid": "aa:bb:cc:dd:ee:ff",
  "wifi_status": 3,
  "wifi_status_name": "connected",
  "stream_count": 0,
  "ws_clients": 0,
  "uptime_s": 42,
  "cpu_mhz": 240,
  "free_heap_kb": 180,
  "min_free_heap_kb": 160,
  "largest_heap_block_kb": 80,
  "free_psram_kb": 8144,
  "psram_size_kb": 8192,
  "largest_psram_block_kb": 7600
}
```

### 3.6 `GET/POST /cam`

Accepted query params:

```text
res
q
brightness
contrast
saturation
sharpness
ae_level
vflip
hmirror
```

Response:

```json
{
  "ok": true,
  "scheduled": true,
  "frame_size": "320x240",
  "jpeg_quality": 12
}
```

The response means values were accepted for deferred application, not necessarily already written to the sensor.

### 3.7 `GET /capture`

Returns a single `image/jpeg` frame or:

```json
{"ok": false, "error": "capture_failed"}
```

### 3.8 `GET/POST /mode`

Request:

```text
/mode?set=wifi
/mode?set=ble
```

Success response:

```json
{"ok": true, "switching_to": "ble"}
```

### 3.9 `GET/POST /end`

Response:

```json
{"ok": true, "action": "clear_wifi_and_reboot"}
```

Firmware clears WiFi credentials and reboots.

### 3.10 WebSocket `/ws`

Endpoint:

```text
ws://<device>/ws?token=<ws_token from /hello>
```

Payload:

- binary WebSocket
- one message equals one complete JPEG
- max JPEG size 256 KB
- no JSON wrapper
- no frame id on the wire

Unauthorized WebSocket upgrades return HTTP 401.

---

## 4. Browser to Server Contract

### 4.1 `POST /api/actions`

Current request:

```json
{
  "v": 1,
  "type": "client.action_submit",
  "session_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "action_id": "act-2026-05-26-0001",
  "exercise_hint": "squat",
  "ts_start_ms": 1779820800000,
  "ts_end_ms": 1779820804000,
  "frames": [
    {
      "frame_id": 0,
      "ts_ms": 1779820800000,
      "joint_angles": [153.6, 151.2, null, 152.0, 162.6, 161.7, 15.6, 14.1, 106.8, 107.9, 150.1, 155.5, 11.2, 1.3]
    }
  ]
}
```

Field rules:

| Field | Rule |
| --- | --- |
| `v` | must be `1` |
| `type` | `"client.action_submit"` |
| `session_id` | string; UUID preferred |
| `action_id` | unique string for this submission |
| `exercise_hint` | client-selected hint; server may classify to another template |
| `frames` | non-empty list |
| `frames[].joint_angles` | exactly 14 floats/nulls |

Current server models do not accept `world_landmarks`.

### 4.2 `GET /api/templates`

Response:

```json
{
  "squat": [153.6, 154.2],
  "deadlift": [162.2, 160.8]
}
```

The key is exercise id. The value is the representative key-angle signal for charting.

### 4.3 `GET /api/history/{action_id}`

Response:

```json
{
  "action_id": "act-...",
  "exercise": "squat",
  "correct": true,
  "dtw_distance": 1.2345,
  "completeness": 0.87,
  "problem_joints": [],
  "frames": [
    {
      "frame_id": 0,
      "ts_ms": 1779820800000,
      "joint_angles": [153.6, 151.2, 141.0, 152.0, 162.6, 161.7, 15.6, 14.1, 106.8, 107.9, 150.1, 155.5, 11.2, 1.3]
    }
  ]
}
```

History is in-memory only in current code.

---

## 5. Server to Browser Action Response

`POST /api/actions` returns:

```json
{
  "action_id": "act-...",
  "exercise": "squat",
  "correct": false,
  "dtw_distance": 6.421,
  "completeness": 0.63,
  "problem_joints": [
    {
      "joint": "left_knee",
      "severity": 0.72,
      "issue": "deviation"
    }
  ],
  "processed_at": "2026-05-26T10:00:00.000000+00:00"
}
```

Current issue code emitted by `main.py` is `"deviation"` for detected spikes.

---

## 6. 14-D Joint Angle Order

`joint_angles_version = 1`

| Index | Name |
| --- | --- |
| 0 | `left_knee` |
| 1 | `right_knee` |
| 2 | `left_elbow` |
| 3 | `right_elbow` |
| 4 | `left_hip` |
| 5 | `right_hip` |
| 6 | `left_shoulder` |
| 7 | `right_shoulder` |
| 8 | `left_ankle` |
| 9 | `right_ankle` |
| 10 | `left_wrist` |
| 11 | `right_wrist` |
| 12 | `trunk_lean` |
| 13 | `pelvis_tilt` |

MediaPipe indices used by the web hook:

| Landmark | Index |
| --- | --- |
| left shoulder | 11 |
| right shoulder | 12 |
| left elbow | 13 |
| right elbow | 14 |
| left wrist | 15 |
| right wrist | 16 |
| left index | 19 |
| right index | 20 |
| left hip | 23 |
| right hip | 24 |
| left knee | 25 |
| right knee | 26 |
| left ankle | 27 |
| right ankle | 28 |
| left foot index | 31 |
| right foot index | 32 |

Current implementation note:

- The active React hook computes these angles from image landmarks.
- The longer-term contract goal is a world-landmark implementation for view invariance.
- If the formula changes, bump `joint_angles_version`.

---

## 7. Template Schema

Server template files use:

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

Each frame must contain exactly 14 joint-angle values.

---

## 8. Privacy and Storage

Current server storage:

- process-local `_actions` dictionary
- gzip-compressed JSON frames
- no raw video
- no image landmarks
- no durable database

Reserved replay fields such as `world_landmarks` require a contract update and matching server model change before use.

---

## 9. Known Contract Mismatches to Fix

| Area | Current mismatch |
| --- | --- |
| WiFi WebSocket | firmware requires `?token=...`; web callers mostly omit it |
| 14-D angles | contract aspires to world-landmark angles; active web hook uses 2D image landmarks |
| Server URL | web hook targets production API; local dev server needs config/proxy |
| Advice | contract reserves advice concepts; current server advice helper is not exposed as an API route |
| Persistence | previous docs described Postgres/Redis; current code uses memory only |
