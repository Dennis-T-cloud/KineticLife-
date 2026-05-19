# KineticLife Firmware Notes

## Overview

The firmware already implements the most complete part of the KineticLife system. Its job is to turn the ESP32-S3 + OV2640 into a session-based camera device that can:

- pair to a phone hotspot by reading a QR code
- temporarily save WiFi credentials in NVS
- reconnect on reboot
- expose a small HTTP API
- stream MJPEG frames to a browser
- clear the active session and return to pairing mode

The firmware is built around a simple state machine rather than a complicated framework. That is the main idea to keep in mind while reading it.

## The Core Mental Model

The firmware has two main operating modes:

1. Pairing mode
2. Streaming mode

Pairing mode uses the camera as a QR scanner. Streaming mode uses the camera as a JPEG video source.

This split matters because the camera is intentionally reconfigured depending on what the device is trying to do:

- pairing mode: grayscale frames for QR decoding
- streaming mode: JPEG frames for browser consumption

That means the camera setup is part of the product flow, not just low-level hardware setup.

## File Map

The most important firmware files are:

- [firmware/src/main.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/main.cpp)
- [firmware/src/wifi_qr.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/wifi_qr.cpp)
- [firmware/src/http_server.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/http_server.cpp)
- [firmware/src/camera_init.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/camera_init.cpp)
- [firmware/src/status_led.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/status_led.cpp)
- [firmware/src/wifi_qr.h](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/wifi_qr.h)
- [firmware/src/http_server.h](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/http_server.h)
- [firmware/src/camera_init.h](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/camera_init.h)

There is also a third-party QR library here:

- [firmware/lib/quirc/src/quirc.h](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/lib/quirc/src/quirc.h)

That file is dependency code, not KineticLife-specific logic.

## What `main.cpp` Is Doing

`main.cpp` is the coordinator for the whole firmware.

Its responsibilities are:

- initialize serial and logging
- initialize the status LED
- load saved WiFi credentials from NVS
- choose pairing mode or streaming mode
- initialize the camera for the chosen mode
- connect to WiFi
- start the HTTP server
- keep servicing HTTP requests and LED behavior in the main loop

The key branch in `setup()` is:

- no saved credentials -> go to QR pairing mode
- saved credentials exist -> initialize camera for stream mode and try WiFi

That is the firmware’s top-level control flow.

## Boot Flow

The boot process is straightforward:

1. Start serial and quiet noisy camera logs.
2. Start the RGB status LED.
3. Log firmware version, board model, and free memory.
4. Attempt to load an active WiFi session from NVS.
5. If no session exists, enter QR pairing mode.
6. If a session exists, initialize the camera for JPEG streaming.
7. Connect to WiFi.
8. Start the HTTP server and mark the device ready.

Important detail:

- WiFi credentials are treated as a temporary active session, not as a permanent device configuration.

That explains why `/end` clears credentials and reboots back to pairing mode.

## Pairing Mode

Pairing mode is implemented by `run_pairing_mode()` in [main.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/main.cpp).

In this mode the firmware:

- sets the LED to the pairing state
- initializes the camera in QR mode
- repeatedly captures frames
- scans each frame for QR codes
- parses WiFi credentials from a successful QR decode
- attempts to connect to WiFi
- stores credentials in NVS if the connection succeeds
- reboots into streaming mode

The loop is intentionally persistent. If scanning fails or WiFi connection fails, the device does not give up. It returns to scanning and waits for another QR.

That makes the firmware demo-friendly and resilient to bad lighting, bad QR distance, or phone hotspot quirks.

## QR Parsing and `quirc`

The QR scan logic lives in [wifi_qr.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/wifi_qr.cpp).

There are two layers here:

1. `quirc` detects and decodes QR content
2. KineticLife code validates and interprets that payload as WiFi credentials

Important takeaway:

- `quirc` handles QR recognition
- KineticLife code handles product behavior

The firmware supports two payload formats:

- compact KineticLife format: `K1:<TYPE_CODE>:<SSID_LEN>:<SSID><PASSWORD>`
- standard WiFi QR format: `WIFI:S:<SSID>;T:<TYPE>;P:<PASSWORD>;;`

The compact format exists because reliable ESP32-side decoding matters for the demo flow.

## What `wifi_qr.cpp` Is Responsible For

`wifi_qr.cpp` does more than decode QR codes. It owns several practical responsibilities:

- loading credentials from NVS
- saving credentials to NVS
- clearing credentials from NVS
- validating auth type
- parsing compact and standard QR payloads
- grabbing grayscale camera frames
- feeding those frames into `quirc`
- logging scan statistics and decode failures

This file is a good example of project-specific glue code. It sits between:

- persistent storage
- camera capture
- third-party QR decoding
- WiFi connection setup

## WiFi Connection Behavior

The connection logic is in `connect_wifi()` in [main.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/main.cpp).

Key behaviors to remember:

- the device enters station mode
- WiFi sleep is disabled
- it tries to connect without a pre-scan
- it polls `WiFi.status()` for up to 60 attempts
- it logs status names like `connect_failed`, `disconnected`, and `connection_lost`
- after a successful connection, it waits again to verify the connection is stable

That last stability check is important. The code is built around the reality that iPhone hotspots can briefly accept a connection and then drop it.

The comment about removing the scan is also important:

- iOS may hide the hotspot SSID when the screen is off
- `WiFi.begin()` can still succeed even when scanning is misleading

This is a good example of the firmware being shaped by real-world testing rather than textbook flow.

## Camera Setup

Camera configuration lives in [camera_init.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/camera_init.cpp).

The firmware assumes a strict hardware baseline:

- Freenove ESP32-S3-WROOM Board (N16R8), FNK0085 B
- OV2640 camera

The pin mapping is hardcoded for that board. If the board or camera differs, camera init can fail.

The two main camera setups are:

- `camera_init()`: JPEG stream mode
- `camera_init_qr()`: grayscale QR mode

Important practical choices:

- stream mode uses PSRAM frame buffers
- QR mode uses DRAM and grayscale
- stream mode targets `240x240`
- the code comments mention DMA throughput issues and avoiding WiFi/camera contention

That means performance and stability are being managed very deliberately.

## HTTP Server Responsibilities

The HTTP layer is in [http_server.cpp](/c:/Users/domin/Downloads/ECE 140B PROJECT/Kinetic-Life-Repo/KineticLife-/firmware/src/http_server.cpp).

Its job is to expose the firmware to the phone browser.

Main endpoints:

- `/hello`
- `/status`
- `/capture`
- `/stream`
- `/cam`
- `/end`

What each one means:

- `/hello`: identity and capability handshake
- `/status`: device health and runtime state
- `/capture`: one JPEG frame
- `/stream`: long-lived MJPEG stream
- `/cam`: runtime camera tuning
- `/end`: clear credentials and reboot back to pairing

The server also sets permissive CORS headers, which makes browser-based testing easier.

## MJPEG Streaming

`/stream` is the heart of the firmware’s runtime behavior once pairing is complete.

The firmware:

- allows only one active stream at a time
- applies optional resolution arguments
- returns multipart MJPEG over HTTP
- stamps each frame with `X-Frame-Id`
- stamps each frame with `X-Timestamp-Ms`
- drops oversized frames above the contract limit
- updates LED behavior while streaming

This is simple but effective. Instead of a complex media stack, the project uses browser-friendly MJPEG and focuses on reliability.

One especially useful detail is that the stream loop still calls `server.handleClient()`. That lets the board keep responding to other requests while a stream is active.

## Status LED as a State Indicator

The LED behavior is not cosmetic. It communicates device state to the user during demos.

`status_led.cpp` maps states to colors and blink patterns:

- boot -> white
- pairing -> blue blink
- connecting -> yellow blink
- ready/streaming -> green
- error/fatal -> red

This matters because many embedded flows are hard to debug without a screen. The LED gives immediate physical feedback about what the firmware thinks is happening.

## Session-Based Design

One of the most important product ideas in the firmware is that WiFi is session-based.

This means:

- credentials are stored only for the current demo session
- the board does not keep a permanent default network
- ending the session wipes WiFi state
- the device returns to a clean pairing flow for the next user

That is a strong fit for a demo booth environment where multiple people may use the same hardware one after another.

## Important Takeaways

- `main.cpp` is the state-machine hub.
- The firmware is organized around pairing mode versus streaming mode.
- QR pairing is a first-class part of the product, not a setup afterthought.
- `wifi_qr.cpp` is the key integration file between camera, QR decode, NVS, and WiFi credentials.
- `quirc.h` is third-party library code; the product logic lives around it, not inside it.
- The code is heavily shaped by real hotspot behavior, especially iPhone hotspot quirks.
- The hardware baseline is strict and baked into camera configuration.
- MJPEG over HTTP is a deliberate simplicity choice for browser compatibility.
- The LED is part of the debugging and user-feedback system.
- The firmware already reflects the product’s privacy and demo-session goals.

## Good Questions to Keep Asking While Reading

- Where is behavior driven by the hardware, and where is it driven by product requirements?
- Which failures return to pairing, and which failures become fatal?
- What assumptions depend on the Freenove FNK0085 B pin mapping?
- Why does the code prefer the simplest reliable transport over a more advanced one?
- How much of the user experience is embedded directly in firmware state transitions?
