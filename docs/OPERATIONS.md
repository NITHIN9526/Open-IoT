# Operations

## Backup

Save .env, .device.env and firmware secrets.h privately. TOKEN_ENCRYPTION_KEY is necessary to decrypt stored device tokens; a database backup without it is incomplete. Do not commit any of these files.

With PostgreSQL running, from the project root:

```sh
docker compose exec -T postgres pg_dump -U openiot -d openiot_m1 -Fc -f /tmp/openiot.dump
docker compose cp postgres:/tmp/openiot.dump ./openiot.dump
```

Copy the dump to private backup storage. This uses docker compose cp rather than shell redirection, avoiding binary corruption in older Windows PowerShell. The repository ignores .dump files, but you must still keep backups out of public uploads.

## Restore

Restore only after stopping the application and making a current backup. The following intentionally replaces database objects and discards newer data:

```sh
docker compose cp ./openiot.dump postgres:/tmp/openiot-restore.dump
docker compose exec -T postgres pg_restore -U openiot -d openiot_m1 --clean --if-exists --no-owner --exit-on-error /tmp/openiot-restore.dump
```

Restore the matching private encryption key, run npm run migrate for any later additive migrations, then restart. Test backups on an isolated database before depending on them. Keep the Docker Compose project name/directory stable so the intended volume is selected.

## Migrations

npm run migrate processes SQL files in order in one transaction with an advisory lock and saved checksums. Rerunning it is safe for already-applied unchanged files. Never edit an applied migration or manually remove its checksum to hide a mismatch. Existing installations should follow UPGRADE.md.

## Automation behavior

Keep Node and PostgreSQL running and the host awake. Browser closure is fine; host sleep is not. Scheduled commands more than 60 seconds late are skipped. Sensor rules disarm on startup and need a reset-side reading before crossing. Offline/busy/credential-changed targets are skipped rather than replayed on reconnection. Device-side physical actions cannot be recalled after receipt.

## Retention and capacity

Telemetry: 24 hours. Finished device commands: seven days. Scene/rule runs: 30 days. Housekeeping requires a running backend. Default two-second sensor publishing produces about 43,200 samples per numeric pin per day. Raw PostgreSQL is suitable for a small installation; partitions, downsampling and quotas are required before large fleets. Limits and rate controls are process-local.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| ECONNREFUSED 127.0.0.1:5433 | Docker running, postgres healthy, matching host port |
| Password authentication failed | Correct instance/port and original initialized database credentials |
| Origin not allowed | Browser scheme/host/port exactly match APP_ORIGIN; restart after changes |
| Reconnecting live updates | Browser WebSocket error, current login, Origin and backend availability |
| Offline device | Board power, Wi-Fi, broker binding/firewall, UUID and token |
| Pending then expired | Device command handler/ACK logs; separate simulator and board identities |
| Rule does not trigger | Numeric input, fresh report, enabled status, reset reading and cooldown |
| Old code after update | Restart dev server and hard reload the browser |

Collect redacted API logs and ESP32 Serial Monitor at 115200 baud. Avoid posting .env, secrets.h, token values, cookies or backup files. Do not reset the database/encryption key to fix ordinary network issues.
