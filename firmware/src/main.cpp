#include <Arduino.h>

#ifndef KINETICLIFE_FW_VERSION
#define KINETICLIFE_FW_VERSION "0.3.0"
#endif

#ifndef KINETICLIFE_BOARD_MODEL
#define KINETICLIFE_BOARD_MODEL "Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B"
#endif

#ifndef KINETICLIFE_CAMERA_MODEL
#define KINETICLIFE_CAMERA_MODEL "OV2640"
#endif

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("KineticLife firmware %s booting...\n", KINETICLIFE_FW_VERSION);
  Serial.printf("Board: %s\n", KINETICLIFE_BOARD_MODEL);
  Serial.printf("Camera: %s\n", KINETICLIFE_CAMERA_MODEL);
}

void loop() {
  delay(1000);
}
