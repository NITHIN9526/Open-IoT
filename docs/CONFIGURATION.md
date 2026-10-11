# Configuration and LAN access

Run `npm run setup` for a fresh installation. It creates .env with random database credentials and a 32-byte encryption key. It will not change existing settings. Copying .env.example is an alternative only if you replace every placeholder yourself.

| Variable | Fresh default | Meaning |
| --- | --- | --- |
| POSTGRES_PASSWORD | Random | Compose database password |
| POSTGRES_PORT | 5433 | Host mapping to container PostgreSQL 5432 |
| DATABASE_URL | Local openiot database on 5433 | Node database connection |
| TOKEN_ENCRYPTION_KEY | Random base64 key | Device token recovery encryption; preserve permanently |
| APP_ORIGIN | http://localhost:5173 | Exact browser origin; no path/trailing slash |
| PORT / HOST | 3000 / 127.0.0.1 | API listener |
| NODE_ENV | development | Local HTTP cookie settings |
| MQTT_ENABLED | true | Start embedded broker |
| MQTT_HOST / MQTT_PORT | 127.0.0.1 / 1883 | Broker listener; change binding for board access |
| TRUST_PROXY | unset | Configure only for a known trusted reverse proxy |
| DOCKER_APP_ORIGIN | http://localhost:3000 | Browser origin for optional Docker app service |

An environment variable already set in your terminal can override .env through Node's env-file behavior. On Windows, inspect only the relevant setting with `node --env-file=.env -p "process.env.APP_ORIGIN"`; never paste the full .env into an issue.

## Port conflict

If 5433 is busy, change BOTH POSTGRES_PORT and the port inside DATABASE_URL to the same free port, then rerun `docker compose up -d --wait postgres`. Do not change the container port 5432. Existing PostgreSQL volumes retain their original credentials: editing POSTGRES_PASSWORD does not reset an initialized database password. Restore your original settings or perform a deliberate database password change; do not delete the volume as a shortcut.

MQTT_PORT must match firmware. If API PORT changes, update web/vite.config.js proxy target and any simulator API_URL accordingly. Keep Vite on 5173 or update APP_ORIGIN to match the actual browser port.

## Windows phone access

Run `ipconfig`, then use the IPv4 address under your active Wi-Fi adapter (not VirtualBox/WSL/Docker adapters). Set APP_ORIGIN to `http://YOUR_IP:5173`, restart the app, and use that address on laptop and phone. Vite binds to all interfaces; API can stay loopback because Vite proxies requests and WebSockets.

On your trusted home network, set the Windows network profile to Private. In Administrator PowerShell, allow the web UI:

```powershell
New-NetFirewallRule -DisplayName "Open IoT Dashboard" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile Private -RemoteAddress LocalSubnet
```

For the ESP32 only, set MQTT_HOST=0.0.0.0 and allow the broker:

```powershell
New-NetFirewallRule -DisplayName "Open IoT MQTT" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 1883 -Profile Private -RemoteAddress LocalSubnet
```

Do not disable the firewall globally, expose PostgreSQL, or add router port forwarding. Guest Wi-Fi/client isolation may block local connections. A router DHCP reservation can keep the laptop address stable.

## Optional Docker app profile (local computer only)

The default quick start runs Node/Vite on the host and PostgreSQL in Docker. Alternatively, after npm run setup:

```sh
docker compose --profile app up --build -d --wait
```

Open http://localhost:3000, NOT 5173. The app image serves the built React frontend and applies migrations on startup. It connects to PostgreSQL at the container hostname/port, not the host mapping. DOCKER_APP_ORIGIN controls its origin independently of the development APP_ORIGIN.

This profile binds web and MQTT to host loopback and is intentionally not reachable from an ESP32/phone by default. Use the documented host development path for LAN hardware, or design a reviewed reverse-proxy/TLS deployment. Do not run the host API and Docker app on port 3000 at the same time. The profile's development mode is not a production deployment template.

## Production direction

Use a built frontend, HTTPS/WSS reverse proxy, explicit HTTPS APP_ORIGIN, NODE_ENV=production, a narrowly trusted proxy, private PostgreSQL, controlled registration, and TLS-authenticated device transport. The firmware does not implement TLS; a secure internet deployment needs firmware changes too. See SECURITY.md. GitHub Pages cannot host the Node/MQTT/PostgreSQL stack.
