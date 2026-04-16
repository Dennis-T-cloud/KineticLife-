# KineticLife-
A pocket-sized magnetic IoT camera node paired with a secure cloud-processing pipeline and a workout planner for Kinematic Analysis.
# KineTrak: Privacy-Preserving Edge-Cloud AI Gym Assistant

## Project Overview
KineTrak is a hybrid IoT and WebAI system designed to provide real-time biomechanical feedback for independent lifters without saving raw video, solving privacy constraints in public gyms.

### System Architecture
1. **Edge Node (ESP32-S3):** Hosts a local Wi-Fi AP and streams MJPEG video.
2. **WebAI Client (React + MediaPipe):** Pulls the local stream, extracts 33 skeletal keypoints into JSON, and flushes video frames instantly (Zero-Video Pipeline).
3. **Cloud Backend (FastAPI + fastdtw):** Receives the JSON sequence, compares it against standard templates using Dynamic Time Warping, and returns actionable form correction data.

### Project Structure
```bash
KineTrak/
├── hardware/          # ESP-IDF C/C++ source code (Member 1 workspace)
│   ├── main/
│   └── sdkconfig
├── frontend/          # React/Vue Web App source code (Member 2 workspace)
│   ├── src/
│   └── package.json
├── backend/           # Python FastAPI source code (Member 3 workspace)
│   ├── app/
│   ├── templates/     # Standard JSON templates for exercises (e.g., squat, deadlift)
│   └── requirements.txt
├── docs/              # API contracts, system architecture diagrams, BOM list
└── README.md          # Project overview, setup guide, and API documentation
```


## 🛠 Development Context & Strict System Constraints

This section defines the mandatory technical boundaries, technology stack, and data schemas for all contributors. Any new feature implementation, module integration, or system extension must strictly adhere to these specifications to ensure complete architectural decoupling.

### 1. Technology Stack
- **IoT Edge:** C++ (ESP-IDF) for ESP32-S3-EYE.
- **Frontend (WebAI):** React.js, TensorFlow.js / MediaPipe BlazePose.
- **Cloud Backend:** Python 3.10, FastAPI, `fastdtw`, Pydantic.

### 2. Data Contract (API Schema)
Strict adherence to this schema is required to prevent integration blockers between the Frontend and Backend components.

**Frontend Request (POST payload):**
`{"session_id": UUID, "timestamp_ms": int, "exercise_intent": str, "rep_count": int, "payload": {"keypoints": [{"id": int, "x": float, "y": float, "z": float, "visibility": float}]}}`

**Backend Response:**
`{"status": str, "analysis": {"is_valid": bool, "score": float, "error_code": str, "coaching_text": str}}`

### 3. Core Architectural Principles
- **Absolute Privacy (Zero-Video Pipeline):** The frontend must NEVER upload image/video binary data or buffers to the backend. Frame data must be flushed from memory the millisecond extraction is complete. Only the sanitized JSON keypoint arrays are transmitted over the public internet.
- **Expectation-Driven Analysis:** The backend relies entirely on the `exercise_intent` variable (e.g., 'squat', 'curl') to load the appropriate Dynamic Time Warping (DTW) template. Do not implement exercise classification models; the system focuses 100% of its compute on biomechanical variance scoring based on user-declared intent.