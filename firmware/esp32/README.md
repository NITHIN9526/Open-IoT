# ESP32 MQTT LED demo

For classic ESP32 DevKit V1 / ESP32-WROOM with PlatformIO. This sample uses the existing Open IoT MQTT backend; it is not a standalone ESP32 web server. It does not drive relays or implement Google/Alexa.

## Configure the backend

Follow the root README first. Register one ESP32 device in Devices. Obtain its UUID from the device page URL `/dashboard/devices/UUID` and its token through the password-protected token dialog.

In backend .env:

```env
MQTT_ENABLED=true
MQTT_HOST=0.0.0.0
MQTT_PORT=1883
```

Restart npm run dev. Expect `MQTT listening on port 1883`. Allow TCP 1883 on the trusted private LAN only. Never port-forward the plain MQTT broker. The device and laptop must be on a reachable private network; the ESP32 requires supported 2.4 GHz Wi-Fi.

## Configure PlatformIO

1. Install VS Code and its PlatformIO extension.
2. Open THIS folder, containing platformio.ini, using File → Open Folder.
3. Copy `include/secrets.example.h` to `include/secrets.h`.
4. Set WIFI_SSID, WIFI_PASSWORD, MQTT_HOST (laptop private IPv4, no scheme/port suffix), DEVICE_ID and DEVICE_TOKEN. Keep port equal to the backend's MQTT port.
5. Connect using a USB data cable. Build, then Upload. Select the board's serial port if autodetection fails. If it waits indefinitely for download mode, hold BOOT while upload connects, then release.
6. Open Monitor at 115200 baud. Close other serial monitors before upload if the port is busy.

Expected startup: `Open IoT MQTT demo. LED OFF at boot; V0 is simulated.` followed by `MQTT connected. Sending telemetry.` An accepted command logs `Applied V1 ...` or `Applied V2 ...`.

Dependencies are pinned in platformio.ini: Espressif32 6.12.0 (Arduino core 2.x), PubSubClient 2.8, ArduinoJson 6.21.5. Do not replace LEDC calls with core 3.x APIs without porting the project.

## Pins

| Virtual pin | Meaning | Hardware |
| --- | --- | --- |
| V0 | Simulated temperature, roughly 22–26°C | No sensor |
| V1 | Boolean power | Enables/disables GPIO 2 LED PWM |
| V2 | Brightness 0–100% | GPIO 2 PWM duty |

LED_PIN defaults to 2. If your board's LED differs, change it. LED_ACTIVE_LOW reverses LED polarity; false is the default. Virtual pins are application channels, not GPIO numbers. Extra dashboard pins require explicit firmware implementation.

MQTT username is `device`, password is the token, and client ID is the device UUID. Topics: publish `iot/UUID/sync`; subscribe `iot/UUID/down`. The sample uses clean sessions, QoS 0, no retained commands, telemetry every two seconds and immediate command acknowledgement. Only V1/V2 commands are implemented by this firmware.

## Limits

- LED off on boot. Best-effort LED-off after 30 seconds without a valid server reply; this is not a hardware safety guarantee.
- Dashboard values retain the last acknowledged state. There is no startup reconciliation or physical output feedback.
- Command expiry is best-effort, and repeated absolute set commands may arrive until acknowledged. It is not exactly-once actuation.
- Plain MQTT/Wi-Fi credentials are local development only. TLS certificate verification and provisioning hardening are not implemented here.
- Do not connect mains appliances based on this LED example.
- Keep secrets.h out of Git. The committed template contains placeholders only. Use distinct device credentials for each simulator/board.

## Troubleshooting

MQTT connection failure: verify laptop IP, broker running/binding, firewall, UUID and token. After rotating a token, replace it in secrets.h and upload again. Online with no control: inspect command history and confirm the firmware's device UUID matches the dashboard device. After enabling new virtual pins, upload firmware that knows those pins; web configuration alone does not add behavior.
