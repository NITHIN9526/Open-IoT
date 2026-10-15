# ESP32 switch firmware and browser generator

Open **Getting Started → Generate ESP32 code** (`/docs?tab=start`) in the web dashboard.

1. Sign in and select your ESP32 device to load its Boolean output virtual pins. Alternatively, enter its UUID and pin mappings manually.
2. Paste the device token from device settings, enter Wi-Fi details, and specify the server's private LAN IPv4 address. Use port 1883, not a Cloudflare URL.
3. Choose up to eight distinct GPIOs and confirm each relay's active-low setting. GPIO defaults are suggestions: match your wiring and board pinout. This template targets classic ESP32 DevKit/WROOM boards, not C3/S3 or PSRAM-reserved pins.
4. Click **Generate code**. Expand each file and use its **Copy** button. Clipboard fallback supports ordinary LAN HTTP pages; if copying is blocked, the text is selected for manual copying.
5. Create a PlatformIO ESP32 Dev Module / Arduino project. Replace `src/main.cpp` and `platformio.ini`, then create `include/secrets.h` with the generated private configuration.
6. Enable MQTT and LAN access on the server, connect your ESP32 by USB, and choose PlatformIO Upload. Use Serial Monitor at 115200 baud.

Credentials are kept only in component memory and generated source. They are not stored in localStorage or sent to a generator API. Clear credentials or leave the page when finished. Never commit or share `secrets.h`. Generated strings use fixed-width UTF-8 octal escapes to safely represent quotes, backslashes and non-ASCII Wi-Fi names in C++.

Firmware handles only mapped Boolean outputs, validates command expiry, and acknowledges exact values through the existing MQTT protocol. It does not create virtual pins, send a dummy temperature reading, dim outputs, or support touch inputs. Create matching Boolean output pins in the dashboard before using manual mappings. Reload pins after editing a device; regenerate and re-upload whenever mappings change. Changing the token also requires updating and uploading `secrets.h`.

All outputs initialize OFF and turn OFF after 30 seconds without a server response. The dashboard retains its last confirmed state; an ACK is not independent physical feedback. Test relay polarity with low-voltage loads before connecting appliances.

For a source-only build, copy `include/secrets.example.h` to `include/secrets.h`, edit its placeholders/mappings, then run `platformio run --project-dir firmware/esp32-relays`. The original `firmware/esp32` LED/brightness demo is unchanged.
