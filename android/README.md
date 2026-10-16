# Open IoT Android companion — 0.1.0 preview

An Android application with native connection setup and a restricted WebView for the existing Open IoT dashboard. It connects to the user's own server; it does not run a server on the phone. The native app has no JavaScript bridge or device-token store. Dashboard authentication, controls, readings, schedules, scenes and account management remain server features.

## Build

Open this directory in Android Studio, using Java 17, Android SDK 36, Android Gradle Plugin 8.10.1 and Gradle 8.11.1. Alternatively install that Gradle version and run:

```sh
gradle :app:testDebugUnitTest :app:lintDebug :app:lintRelease :app:assembleDebug :app:bundleRelease
```

The Android preview GitHub Actions workflow installs this toolchain and uploads a debug-signed APK plus an **unsigned** AAB. The APK is for sideload testing only. The AAB is not ready to upload to Play until signed with the owner's private upload key. No signing secrets belong in Git. CI debug signing keys are not stable across runners; uninstalling a previous debug APK may be needed when installing a new candidate (clears the app's local session, not server data).

## Connect

1. Install the preview APK on Android 8 or later. Keep your server running.
2. Enter the exact dashboard origin, including port when needed. Set the same origin in server configuration. For a source server this is usually port 5173; for the installer it is usually 3000.
3. HTTPS is supported in both builds. The debug preview also permits HTTP for explicit private IPv4 addresses (10/8, 172.16/12, 192.168/16) after acknowledging unencrypted traffic. The release build permits **HTTPS only**. HTTP LAN setups need a valid HTTPS endpoint before using the Play build.
4. Tap Check and connect, then sign in. The health check verifies reachability and `{ok:true}`; it is not proof of the server owner's identity. Connect only to a server you trust.
5. Use Server to change the address or forget the server and clear the session. Reload/Reconnect goes to the dashboard without resending a command.

Localhost refers to the phone, not the laptop. Wi-Fi, firewall, server LAN access and the exact APP_ORIGIN still matter. HTTPS redirects must be entered using the final origin. Files/downloads and native background notifications are not included. Third-party resources embedded in the dashboard are blocked; external HTTPS links require user confirmation and open in a browser. Cookies and browser storage belong to this app. Forget server clears local state; it does not revoke every server-side session or delete the account.

## Validation required on real devices

- Fresh install and saved-address restart; rotate and use large fonts.
- Login, logout, registration policy, account deletion, and exact-origin checks.
- Confirmed ON/OFF command and sensor update on an actual ESP32.
- Rooms, scenes, rules and schedules through the dashboard.
- Wi-Fi loss/reconnect, unreachable server, expired certificate, wrong port.
- Debug private HTTP consent and release HTTP rejection.
- Server switch clears prior session; no file/content URLs or cross-origin page navigation.
- API 26 and API 36 back behavior, keyboard insets and edge-to-edge layouts.

The initial application ID is `io.github.nithin9526.openiot` (preview suffix `.debug`). Confirm this before first Play upload; the published app ID cannot subsequently be changed for the same listing. This preview is not Play-approved.
