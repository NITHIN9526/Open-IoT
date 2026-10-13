#pragma once
#include <Arduino.h>
// Copy to secrets.h locally, or generate this file in Getting Started.
constexpr char WIFI_SSID[] = "YOUR_WIFI_NAME";
constexpr char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
constexpr char MQTT_HOST[] = "192.168.1.50";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char DEVICE_ID[] = "YOUR_DEVICE_UUID";
constexpr char DEVICE_TOKEN[] = "YOUR_DEVICE_AUTH_TOKEN";
struct Channel { const char *pin; uint8_t gpio; bool activeLow; };
constexpr Channel CHANNELS[] = {
  {"V1", 23, true}, {"V2", 22, true}, {"V3", 21, true}, {"V4", 19, true},
  {"V5", 18, true}, {"V6", 27, true}, {"V7", 26, true}, {"V8", 25, true},
};
constexpr size_t CHANNEL_COUNT = sizeof(CHANNELS) / sizeof(CHANNELS[0]);
