# Connect Open IoT to Google Home and Google Assistant

This guide is for people self-hosting their own Open IoT installation. It covers preparing a device, creating their own Google project, account linking, phone controls, voice commands, restarting the service, and troubleshooting.

Open IoT supports Google **Cloud-to-cloud** discovery, state queries and commands. Its current Google capabilities are OnOff and optional Brightness. This is a development integration: installing this repository does not make Open IoT a publicly listed or certified Works with Google Home service.

## Before you start

You need:

- An installed Open IoT backend with SQL migration `005-voice-oauth.sql` applied.
- Node.js 22.12 or later (matching package.json), npm, Docker Desktop for the bundled PostgreSQL, and Git for cloning.
- Google Home on your phone and a Google account that can access the Google Home Developer Console.
- One registered device: the MQTT ESP32 demo or the HTTP simulator works.
- Internet access for the phone, Google services, and your public HTTPS endpoint. ESP32-to-laptop MQTT can stay on your LAN.
- A public HTTPS origin reachable by Google. A temporary tunnel is sufficient for private testing; use a fixed domain and managed hosting for a persistent installation.

If another person operates the Open IoT server and already provides a supported Google integration, ask that operator for its linking instructions rather than creating an unrelated Google project. A self-hoster must provision an OAuth client for their own Google project.

## 1. Verify the local platform first

For a fresh installation, clone the repository and generate private configuration:

```powershell
git clone https://github.com/NITHIN9526/Open-IoT.git
cd Open-IoT
npm ci
npm run setup
```

The checkout must include `server/routes/googleSmartHome.js` and `sql/005-voice-oauth.sql`. Until the voice update is merged, use the reviewed voice feature branch or apply the supplied patch; release 5.1 alone cannot serve these endpoints. Existing users should work in their current checkout, run `npm ci`, and preserve `.env` and their database volume.

Then run:

```powershell
docker compose up -d --wait postgres
npm run migrate
npm run build
```

Run `npm run dev`, open `http://localhost:5173`, create an account, and register a device. Do not configure voice until you can control the device in Open IoT.

For ESP32, open `firmware/esp32` in PlatformIO, copy `include/secrets.example.h` to `include/secrets.h`, and enter your Wi-Fi, laptop's LAN broker address, device UUID and device auth token. Build/upload and monitor at 115200 baud. The current sample uses GPIO2 for the LED. A Google OAuth client secret must never be placed in ESP32 firmware.

For a simulator, copy `.device.env.example` to `.device.env`, set `DEVICE_TOKEN` to the registered device token and `API_URL=http://127.0.0.1:3000`, and run `npm run simulate` in a separate terminal. The HTTP simulator does not need MQTT enabled; ESP32 MQTT does.

In the dashboard, confirm **Online**, turn V1 power on/off, set V2 brightness, and wait for **Device confirmed**. V0 temperature in the ESP32 sample is simulated; it is not exposed by this Google integration.

## 2. Start an HTTPS tunnel

### Cloudflare on Windows

Install cloudflared, close/reopen the terminal to refresh PATH, then verify:

```powershell
winget install --id Cloudflare.cloudflared
cloudflared --version
cloudflared tunnel --url http://127.0.0.1:3000
```

The last command runs continuously. Keep that terminal open and copy the printed HTTPS address, for example `https://YOUR-TUNNEL.trycloudflare.com`. Do not copy a URL belonging to another user.

It is normal for the tunnel to start before the backend. Until the backend starts, visiting it may show a gateway error. A missing default cloudflared config file is not an error for this quick-tunnel command; look for a registered tunnel connection.

If cloudflared is installed but not recognized, restart Windows Terminal or your IDE. If necessary refresh the current PowerShell PATH:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
cloudflared --version
```

### ngrok alternative

Install ngrok using its official instructions, authenticate the agent, and run:

```powershell
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
ngrok http 3000
```

Use its printed HTTPS forwarding origin. If a browser interstitial or authentication challenge blocks provider callbacks, choose an endpoint configuration that supports non-interactive OAuth and webhook requests.

Neither HTTP tunnel exposes MQTT port 1883. Keep MQTT on your trusted LAN; the ESP32 uses the laptop's current LAN IP, not the HTTPS tunnel hostname.

## 3. Configure and start the built backend

In a second terminal, open the project's existing `.env` and replace duplicate/old entries. Keep `DATABASE_URL`, `POSTGRES_PASSWORD` and `TOKEN_ENCRYPTION_KEY` unchanged.

```dotenv
APP_ORIGIN=https://YOUR-PUBLIC-HOST
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
TRUST_PROXY=loopback
VOICE_ENABLED=true
# Required for the MQTT ESP32 example:
MQTT_ENABLED=true
MQTT_HOST=0.0.0.0
MQTT_PORT=1883
```

`APP_ORIGIN` is the exact origin with no trailing slash or path. `TRUST_PROXY=loopback` assumes your tunnel agent runs on the same computer. Other reverse-proxy arrangements require their own explicit trusted proxy configuration. Alexa's optional bridge secret is not needed for Google-only testing.

Stop an older backend process, then:

```powershell
npm run build
npm start
```

Open `https://YOUR-PUBLIC-HOST/dashboard` and log in. Use this HTTPS origin throughout the procedure. Production secure cookies will not log you into a plain HTTP laptop URL. Vite port 5173 is not the tunnel target for these instructions.

Verify database reachability at `https://YOUR-PUBLIC-HOST/api/health`; it should return `{"ok":true}`. This health response does not prove MQTT connectivity or OAuth linking.

## 4. Create your Google developer project

1. Open [Google Home Developer Console](https://console.home.google.com/) using the Google account you will use on your phone.
2. Create a project and record its **Project ID**, not just its display name. Use your own ID wherever this guide says `YOUR_PROJECT_ID`.
3. Choose **Add cloud-to-cloud integration**. The setup is Cloud-to-cloud, not Matter.
4. On the first-time Resources page choose **Next: Develop**, then on the Checklist choose **Next: Setup**.
5. Enter integration name **Open IoT** (or a clear name you prefer).
6. Select **Light** for devices mapped to power and brightness. Select **Switch** for power-only mappings; choose both if you will expose both kinds.
7. Upload the required app icon. A generic 144×144 PNG is provided at [docs/assets/open-iot-icon.png](assets/open-iot-icon.png). You may rename it to **YOUR_PROJECT_ID.png** for easy identification; that filename is not an OAuth setting. Follow the console's current branding requirements.

Do not generate Google Cloud OAuth credentials and substitute them for the client registered in the next step. In this flow, Open IoT is the OAuth authorization server and Google is its client.

## 5. Generate your OAuth client secret

In a third terminal in the project root, replace both occurrences of `YOUR_PROJECT_ID` and run this **once**:

```powershell
node --env-file=.env scripts/register-oauth-client.mjs google openiot-google "https://oauth-redirect.googleusercontent.com/r/YOUR_PROJECT_ID" "https://oauth-redirect-sandbox.googleusercontent.com/r/YOUR_PROJECT_ID"
```

The output displays Client ID `openiot-google` and a randomly generated client secret. Save the secret in your private password manager and paste it into Google's Client secret field. The plaintext secret is displayed once; the database stores only its hash.

| Credential | What it is used for |
| --- | --- |
| Open IoT email and password | User login on the consent page |
| Device UUID | Identifying the device and its mapping |
| Device auth token | ESP32/simulator authentication to Open IoT |
| Google OAuth client ID and secret | Google exchanging account-linking codes/tokens |
| ngrok authtoken, if used | Authenticating the ngrok agent |

These values are not interchangeable. Restarting the tunnel or backend does not require another client secret.

If you receive a duplicate-client error, the client was already created. Reuse its saved secret. If you lost it, provision a new client ID such as `openiot-google-v2` using the same command with that ID, update **both** Google's client ID and secret, then relink. Do not delete the platform database to recover a client secret. Disable/revoke obsolete clients/grants through a reviewed administrative procedure.

## 6. Complete Google's setup fields

Replace `YOUR-PUBLIC-HOST` in every URL with the same host used by APP_ORIGIN.

| Google console field | Value |
| --- | --- |
| Integration name | Open IoT |
| OAuth Client ID | `openiot-google`, or the ID you actually provisioned |
| Client secret | Your newly generated client secret |
| Authorization URL | `https://YOUR-PUBLIC-HOST/oauth/authorize` |
| Token URL | `https://YOUR-PUBLIC-HOST/oauth/token` |
| Cloud fulfillment URL | `https://YOUR-PUBLIC-HOST/voice/google` |
| Scope | `devices:control` |
| Local fulfillment | Off |
| App Flip: Android and iOS | Off |
| Transmit ID and secret via HTTP Basic checkbox | Unchecked for these instructions; the backend also supports Basic if deliberately configured |

Choose **Save**. Under Cloud-to-cloud → Develop, the integration should appear as a Draft. Choose **Next: Test**. Its status should be Ready.

The authorization URL is not a normal login page to open without parameters: Google supplies client ID, state and callback parameters when starting account linking. Opening `/oauth/authorize` directly without them correctly returns `invalid_request`.

## 7. Explicitly enable voice for a device

Registered devices are private by default. Enable only devices you intend the linked account to control. Find its UUID in the Open IoT device control page address or device details. Do not paste the auth token into the UUID field.

### PowerShell method (recommended on Windows)

Run this in a separate terminal. Change the public origin and device UUID when prompted. Enter your **Open IoT** email/password, not your Google password. The password input is hidden.

```powershell
$iotOrigin = (Read-Host 'Open IoT HTTPS origin, without trailing slash').TrimEnd('/')
$iotDevice = Read-Host 'Device UUID'
$iotEmail = Read-Host 'Open IoT email'
$iotPassword = Read-Host 'Open IoT password' -AsSecureString
$iotCredential = [PSCredential]::new($iotEmail, $iotPassword)

try {
    $iotBody = @{
        email = $iotEmail
        password = $iotCredential.GetNetworkCredential().Password
    } | ConvertTo-Json

    $iotAuth = Invoke-RestMethod `
        -Uri "$iotOrigin/api/auth/login" `
        -Method Post `
        -ContentType 'application/json' `
        -Headers @{ Origin = $iotOrigin } `
        -Body $iotBody `
        -SessionVariable iotSession `
        -ErrorAction Stop

    $iotMapping = @{ powerPin = 'V1'; brightnessPin = 'V2' } | ConvertTo-Json

    Invoke-RestMethod `
        -Uri "$iotOrigin/api/voice/devices/$iotDevice" `
        -Method Put `
        -ContentType 'application/json' `
        -Headers @{ Origin = $iotOrigin; 'X-CSRF-Token' = $iotAuth.csrfToken } `
        -WebSession $iotSession `
        -Body $iotMapping `
        -ErrorAction Stop
}
finally {
    Remove-Variable iotBody, iotCredential, iotPassword, iotAuth, iotSession `
        -ErrorAction SilentlyContinue
}
```

Expected output: `ok` / `True`. For a power-only switch, use `$null` instead of `'V2'` for brightnessPin before executing. Power must be a boolean output; brightness must be a numeric output whose min/max are exactly 0/100. Other V0–V31 pins may be used when their metadata matches.

### Browser method (other operating systems)

From your signed-in HTTPS dashboard, use Developer Tools → Console after reviewing the code. It calls only your own server and uses your current session.

```javascript
(async () => {
  const deviceId = 'YOUR-DEVICE-UUID';
  const me = await fetch('/api/auth/me').then(r => r.json());
  const result = await fetch(`/api/voice/devices/${deviceId}`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken},
    body: JSON.stringify({powerPin: 'V1', brightnessPin: 'V2'})
  });
  console.log(result.status, await result.json());
})();
```

Expected result: `200 {ok:true}`. If Chrome blocks pasting, use the PowerShell method instead of disabling browser protections. `allow pasting` can be treated as invalid JavaScript when its paste-protection prompt is not active.

After mapping, keep the ESP32/simulator online. Toggle power and set brightness once in the dashboard; wait for both device ACKs. Google QUERY needs confirmed values for all mapped traits. The firmware's heartbeat alone does not establish an initial power/brightness state.

## 8. Link the phone's Google Home account

1. Open Google Home on your phone.
2. Check its profile account matches the developer account (or an authorized project tester).
3. Tap **Add (+)** → **Device** → **Works with Google Home**. In some versions it is under **Link apps or services**.
4. Search for your integration name and choose **[test] Open IoT** (or your chosen name).
5. The browser opens Open IoT's consent page. Enter your Open IoT credentials and choose **Agree and link**.
6. Google discovers the devices enabled for that Open IoT account. Choose a home and room.
7. Open the device tile and test power and brightness.

If a test integration is not visible, check project access and Google account alignment. Google's documented tester setup includes adding the tester as Viewer/Editor to the backing Google Cloud project, allowing access to the Developer Console, and opening Test/Retest to reach the Test Suite. Do not grant broad project permissions to unrelated users merely to make a public integration visible; public availability requires the appropriate launch process.

## 9. Test voice commands and acknowledgements

Use the device name shown in Google Home. For a device called Desk lamp:

- “Hey Google, turn on Desk lamp.”
- “Hey Google, turn off Desk lamp.”
- “Hey Google, set Desk lamp brightness to 50 percent.”

Use whichever Google voice interface on your phone or speaker supports your account/region. Confirm the physical LED responds and the dashboard state is updated. A returned success means the existing device ACK flow confirmed the command, not that Open IoT measured electrical output.

Command requests have a short acknowledgement window. A lost ACK can produce an error even if hardware applied the command. Do not treat voice success as a safety interlock or guaranteed physical feedback.

## 10. Run the Google Home Test Suite

In Developer Console → Cloud-to-cloud → Test, choose **Test** beside the integration. Select the linked devices, create a test plan, and run it. The devices must be linked and visible first. Review individual failures and logs rather than assuming phone controls imply full certification.

Tests that require Report State or Request Sync cannot pass with this increment; the Test Suite is useful for identifying those remaining gaps. This implementation sets `willReportState:false`. Home Graph Report State, Request Sync and platform-initiated unlink notification are not implemented yet. Do not enable/report those capabilities until their backend lifecycle support is added. Public launch requires completing current Google requirements; this guide does not claim the integration has been certified.

## 11. Restarting the laptop or stopping a tunnel

Your user, device and client records are stored in PostgreSQL. You do not need new credentials simply because you closed an IDE or terminal.

1. Start Docker Desktop and run `docker compose up -d --wait postgres` in the project root.
2. Start the tunnel and note its HTTPS origin.
3. If the origin changed, replace APP_ORIGIN and Google's Authorization URL, Token URL and fulfillment URL with the new origin. Keep callback allowlists based on the Google **project ID**, and keep the same saved client secret.
4. Run `npm start` after saving `.env`. If an old process still owns port 3000, stop it before restarting.
5. Keep the tunnel and backend terminals open; reconnect/power the ESP32.
6. Log in at the new dashboard URL. If linking was interrupted, close the old consent page and begin a new linking flow; its browser cookie/code may have expired.

For a permanent service, replace the changing quick tunnel with a fixed HTTPS hostname and keep the application/broker/database available. Publishing this code to GitHub does not host those services.

## 12. Troubleshooting

| Symptom | Check and resolution |
| --- | --- |
| `invalid_request` immediately on opening authorize URL | Start linking from Google Home; a bare URL has no required OAuth parameters. Check client ID, exact project callback URLs and scope. |
| `invalid_request` after Agree and link | Confirm current APP_ORIGIN matches the phone's public URL; reopen linking to get a fresh interaction cookie. Ensure the OAuth browser fix is present: Referrer-Policy `same-origin` and CSP allowing the validated callback origin. Never remove the Origin/CSRF checks. |
| `invalid_client` or linking fails after consent | Confirm Google's client ID/secret matches the provisioned client and only one client authentication method is selected. The device token is not a client secret. |
| Web dashboard online, Google offline | Confirm both mapped states have ACKed values. Toggle V1 and set V2 once. Check Google is linked to the same Open IoT account and current fulfillment URL. Reopen the device after refresh; persistent errors require inspecting QUERY responses/provider logs. |
| Offline in both apps | Check ESP32 power/Wi-Fi, LAN broker host, MQTT_ENABLED, token, and Private-network firewall rules. Restart/reconnect the ESP32. |
| No discovered devices | Mapping must succeed for the account used on the consent page. Save again after rotating device credentials, then re-discover/relink. Input pins cannot be mapped as power/brightness. |
| `[test]` integration missing | Check phone's Google account and project membership; visit Test/Retest in the developer console as documented for testers. |
| Tunnel gateway error | Check npm start is running on 3000 and PostgreSQL is healthy; the tunnel must target that port. |
| Port 3000 already used | Stop the previous Open IoT process; do not run a second instance against a different origin. |
| `cloudflared` not recognized | Reopen terminal/IDE after installation or refresh PATH. |
| Duplicate OAuth client ID | Reuse the existing saved secret; do not repeatedly run provisioning on restarts. |
| Consent redirects blocked in browser | Verify the included browser fix and native-form regression test; do not disable Helmet globally. |
| Dashboard HTTP LAN login stops in production mode | Use the configured HTTPS public origin for secure cookies. Restore development settings when returning to local-only development. |

## 13. Unlink and revoke access

In Google Home's linked services settings, select your Open IoT service and unlink it. The backend DISCONNECT handler revokes that link grant. Password changes revoke all voice grants, requiring account relinking; ordinary dashboard logout does not unlink assistants.

An administrator/user can list/revoke grants through `/api/voice/grants` using the normal authenticated session/CSRF flow; see [the backend guide](VOICE_CONTROL.md). For Google, also unlink in its app because revoking locally alone does not delete the cached Home Graph record. Commands delivered before unlinking may still complete.

Keep `.env`, device tokens, firmware `secrets.h`, client secrets and database backups out of GitHub. Only placeholders and example templates belong in commits.

## Official references

Checked 2026-10-12; console and phone labels may vary:

- [Create a Cloud-to-cloud integration](https://developers.home.google.com/cloud-to-cloud/integration/create)
- [Google OAuth authorization-code setup](https://developers.home.google.com/cloud-to-cloud/project/authorization)
- [Testing and tester access](https://developers.home.google.com/cloud-to-cloud/test)
- [Google Home Test Suite](https://developers.home.google.com/cloud-to-cloud/tools/test-suite)
- [Cloudflare quick tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [ngrok setup](https://ngrok.com/docs/start)
