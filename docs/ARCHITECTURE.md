# Architecture and device protocol

## Components

- Express owns account/device APIs, session cookies, CSRF and ownership checks.
- Aedes is an embedded MQTT broker in the same process. Credentials bind a client ID to one device and its topics.
- PostgreSQL stores users, sessions, devices, typed virtual pins, commands, samples, dashboards, schedules, rooms/groups, scenes, rules and routine history.
- ws provides authenticated read-only browser snapshots. Commands use the HTTP API; arbitrary inbound socket messages are rejected.
- The scheduler evaluates clock schedules; the rule engine polls fresh latest numeric input values. Both enqueue through the manual command path.
- React/Vite/Tailwind renders the workspace. react-grid-layout manages widgets. The local-HTTP UUID fallback uses cryptographic getRandomValues.

Redis/TimescaleDB, external broker clustering and distributed workers are not included. Single-instance operation is the supported starter topology. In-process MQTT sessions/events require redesign for scale-out.

## Database migrations

| Migration | Tables |
| --- | --- |
| 001 | users, sessions, devices |
| 002 | device_pins, device_commands, telemetry_samples |
| 003 | dashboards, dashboard_widgets, automations, automation_runs |
| 004 | device_groups, scenes, sensor_rules, routine_runs, routine_results |

Tokens are high-entropy credentials. SHA-256 supports lookup; AES-256-GCM supports owner/password-authorized recovery. TOKEN_ENCRYPTION_KEY must remain private. Passwords use bcrypt. Device names and virtual pins do not grant ownership; the user-device relationship is checked by the server.

## Browser API

Writes require a session cookie, configured exact Origin, JSON content type and X-CSRF-Token. Obtain session/CSRF through the normal auth flow. Device credentials never belong in browser WebSocket query strings.

| Endpoint | Purpose |
| --- | --- |
| /api/auth/*, /api/account | Account and session flows |
| /api/devices | Device registry |
| /api/devices/:id/state | Pins and recent command outcomes |
| /api/devices/:id/history?pin=V0 | Latest 120 numeric samples |
| /api/devices/:id/pins | Add typed virtual pins |
| /api/devices/:id/commands | Enqueue an absolute set command |
| /api/live?deviceId=UUID | Session-authenticated WebSocket snapshots |
| /api/dashboard-layout | Saved widgets/layout version |
| /api/automations | Time-based schedules and history |
| /api/groups, /api/scenes, /api/rules | Routine CRUD |
| /api/scenes/:id/run | Execute scene with client-generated run UUID |
| /api/routines | Owner-scoped routine read model/history |

Read the route modules for method/schema details. DELETE browser requests also use JSON bodies (an empty object where no confirmation fields are required).

## Device transport

HTTP: POST /api/device/sync with Authorization: Bearer DEVICE_TOKEN and a JSON body.

MQTT: username `device`, password DEVICE_TOKEN, client ID device UUID, clean session, no will, no retained telemetry or commands. Publish `iot/UUID/sync`; subscribe only `iot/UUID/down`.

Telemetry body:

```json
{"telemetry":[{"pin":"V0","value":24.7}],"acknowledgements":[]}
```

Responses include serverTime, commands, acknowledged and ignored. Commands have id, pin, value, expiresAt. MQTT additionally includes valueText, the original JSON literal, for precise firmware acknowledgement without float round-trip mismatches.

After applying a command, report its ID and the actual accepted target value:

```json
{"telemetry":[],"acknowledgements":[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","value":true}]}
```

Only use the real delivered command ID. Duplicate accepted ACKs do not overwrite newer states. Type/bounds, device identity, token version and command expiry are checked. Invalid tokens or disallowed topics cannot access other devices.

## Delivery semantics

A command is pending for 15 seconds; one pending command is allowed per pin. Delivery can repeat until ACK/expiry. Operations are absolute SET values, not relative toggles. There is no exactly-once physical guarantee: applied work may be unconfirmed if the ACK is lost. Scenes have independent action outcomes, not physical transaction semantics.

Sensor rules need a reset-side reading, then a crossing; a crossing during cooldown is consumed. Latest-state polling may miss rapid transitions. Freshness is based on backend receipt time. Source credential changes disable rules; target changes skip actions. Worker locks and transactional records prevent duplicate database scheduling within the supported single-instance model, but hardware still needs idempotent commands and explicit boot-state reconciliation for real control applications.

## Development references

- https://github.com/moscajs/aedes
- https://github.com/websockets/ws
- https://github.com/knolleary/pubsubclient
- https://github.com/react-grid-layout/react-grid-layout
- https://github.com/harrisiirak/cron-parser
- https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs
- https://github.com/actions/checkout
- https://github.com/actions/setup-node
