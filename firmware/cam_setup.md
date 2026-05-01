# Camera Parameter Setup

Runtime camera tuning via HTTP — no reflash required.
All requests go to the ESP32 directly on the local network.

Replace `<IP>` with the ESP32's actual LAN IP (printed in serial log on boot):
```
[network] http=http://<IP>/  ws=ws://<IP>/ws
```

---

## Default Settings (firmware init)

| Parameter    | Default | Source                        |
|--------------|---------|-------------------------------|
| resolution   | QVGA (320×240) | `camera_init.cpp:171`  |
| jpeg_quality | 12      | `camera_init.cpp:171`         |
| brightness   | 0       | `camera_init.cpp:99`          |
| contrast     | 1       | `camera_init.cpp:100`         |
| saturation   | 0       | `camera_init.cpp:101`         |
| sharpness    | 1       | `camera_init.cpp:102`         |
| ae_level     | 0       | `camera_init.cpp:95`          |
| vflip        | 0       | sensor hardware default       |
| hmirror      | 0       | sensor hardware default       |
| whitebal     | 1 (on)  | `camera_init.cpp:90`          |
| awb_gain     | 1 (on)  | `camera_init.cpp:91`          |
| gain_ctrl    | 1 (on)  | `camera_init.cpp:92`          |
| exposure_ctrl| 1 (on)  | `camera_init.cpp:93`          |
| aec2         | 1 (on)  | `camera_init.cpp:94`          |

Restore defaults URL:
```
http://<IP>/cam?res=320x240&q=12&brightness=0&contrast=1&saturation=0&sharpness=1&ae_level=0&vflip=0&hmirror=0
```

---

## Parameter Reference

| Parameter    | Range        | Notes                          |
|--------------|--------------|--------------------------------|
| `q`          | 4–63         | Lower = better quality, larger frame |
| `brightness` | -2 to 2      |                                |
| `contrast`   | -2 to 2      |                                |
| `saturation` | -2 to 2      |                                |
| `sharpness`  | -2 to 2      |                                |
| `ae_level`   | -2 to 2      | Exposure compensation          |
| `vflip`      | 0 / 1        | Vertical flip                  |
| `hmirror`    | 0 / 1        | Horizontal mirror              |
| `res`        | `320x240` / `640x480` | Switching to larger size requires DMA reinit (handled automatically) |

Settings are **not persistent** — reset to firmware defaults on reboot.
To make a value permanent, edit `camera_init.cpp:90-102` and reflash.

---

## Common Tuning URLs

**Low light / indoor:**
```
http://<IP>/cam?brightness=2&ae_level=2&contrast=1
```

**Improve MediaPipe skeleton detection:**
```
http://<IP>/cam?contrast=2&sharpness=2
```

**Better image quality (higher bandwidth):**
```
http://<IP>/cam?q=6
```

**Higher FPS / lower bandwidth:**
```
http://<IP>/cam?q=20
```

**Upgrade to VGA (640×480):**
```
http://<IP>/cam?res=640x480
```

**Flip for inverted lens mount:**
```
http://<IP>/cam?vflip=1&hmirror=1
```

**Combined example (indoor, MediaPipe optimized):**
```
http://<IP>/cam?brightness=1&contrast=2&sharpness=1&ae_level=1&q=8
```

---

## Verify Current State

```
http://<IP>/status
```

Returns JSON with current camera mode, resolution, quality, WiFi RSSI, and memory stats.
