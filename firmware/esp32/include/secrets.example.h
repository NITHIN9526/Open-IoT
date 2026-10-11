#pragma once
// Copy to secrets.h locally. Never commit secrets.h.
constexpr char WIFI_SSID[] = "YOUR_WIFI_NAME";
constexpr char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
// Bare private IPv4 address, no http:// and no port suffix.
constexpr char MQTT_HOST[] = "192.168.1.10";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char DEVICE_ID[] = "YOUR_DEVICE_UUID";
constexpr char DEVICE_TOKEN[] = "YOUR_DEVICE_AUTH_TOKEN";
constexpr uint8_t LED_PIN = 2;
constexpr bool LED_ACTIVE_LOW = false;
