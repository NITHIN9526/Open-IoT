#!/usr/bin/env bash
set -uo pipefail
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
adb shell input keyevent 82
cd android
status=0
gradle --no-daemon :app:connectedDebugAndroidTest || status=$?
cd ..
adb exec-out screencap -p > android-emulator.png
adb pull /sdcard/Android/data/io.github.nithin9526.openiot.debug/files/android-setup.png android-setup.png || true
exit "$status"
