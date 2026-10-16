# Android release preparation

## Prepared in the repository

- Android companion source with server setup and connection checks.
- API 36 target and Android 8 minimum; no native libraries bundled.
- Debug APK and unsigned release AAB CI builds, unit tests and lint.
- HTTPS-only release variant; private-LAN HTTP is debug-only.
- In-app data-handling information and local session clearing.

## Owner tasks before publishing

1. Create/use your Play Console developer account and finish its verification yourself. Do not share passwords, payment information or identity documents in repository issues/chat.
2. Confirm app name, application ID, support email and developer identity.
3. Test on real Android phones and a working Open IoT server; resolve failures. CI building successfully is not device acceptance testing.
4. Create and retain a private upload key and configure release signing locally or through protected CI secrets. Use Play App Signing. Do not upload the unsigned CI bundle or publish a debug APK as production.
5. Publish a complete public privacy policy with the verified operator/contact details. Complete Data safety based on the app AND connected-service behavior. Do not automatically claim "no data collected" merely because the app has no analytics SDK.
6. Provide account-deletion information and any required public deletion-request URL. The server's My account deletion feature alone does not replace every Play declaration/URL requirement.
7. Supply listing icon (512x512), feature graphic (1024x500) and real phone screenshots; do not use fake controls or claim unsupported features.
8. Give reviewers a working, isolated HTTPS demo server and test account, with simulated devices rather than physical home appliances. Explain server address setup under App access.
9. Complete content rating, target audience, ads, app access, Data safety and other applicable declarations accurately.
10. Use internal testing, then any required closed testing and production-access application, followed by Google review. The app must provide adequate working functionality; a WebView shell is not a guarantee of acceptance.

## Draft store text (review before submission)

Name: Open IoT

Short description: Connect to your own Open IoT server and control your connected devices.

Full description:
Open IoT is a companion for your self-hosted Open IoT server. Connect your server, sign in, and use its mobile dashboard to control switches, view sensor readings, organize rooms, run scenes and manage schedules.

Your server must be installed separately and remain online. The release app requires a valid HTTPS server address. Features depend on your server version and device firmware. This app does not provide a hosted server, provision ESP32 firmware or operate devices without a server connection.

## Policy references checked 2026-10-16

- Target API requirements: https://support.google.com/googleplay/android-developer/answer/11926878 — new phone apps currently require API 36.
- Personal-account testing: https://support.google.com/googleplay/android-developer/answer/14151465 — applicable newer personal accounts require at least 12 testers continuously opted into a closed test for 14 days before applying for production access. Verify applicability in the owner's console.
- User data: https://support.google.com/googleplay/android-developer/answer/10144311
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111

No Play account has been accessed and no store submission has been made by this change.
