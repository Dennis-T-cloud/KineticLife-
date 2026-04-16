wifi_init_softap();

camera_init();

start_mjpeg_server();

sdkconfig.defaults {CONFIG_ESP32S3_SPIRAM_SUPPORT=y}