# Open IoT Server for Windows — installer candidate

This branch adds a Windows x64 installer candidate. It bundles Node.js 24, PostgreSQL 17 and a WinSW service. The Windows CI job must pass before distributing the installer. The installer is currently unsigned; it is not yet a signed stable release.

## Install and operate

1. Download **OpenIoT-Windows-x64-candidate** from the successful **Windows installer candidate** GitHub Actions run for this branch/PR. Extract the artifact ZIP. It contains `OpenIoT-Setup-5.1.0-windows-x64.exe` and `SHA256SUMS.txt`.
2. On Windows 10/11 x64, run the installer as an administrator. It installs its own runtimes; you do not need to install Node, npm, Docker or PostgreSQL separately. Close any manually started Open IoT server first: ports 3000, 3001, 1883 and 5440 must be available. Windows on ARM is not included in this candidate.
3. Leave **Open server setup** selected. Initial database creation may take a minute. You can reopen **Open IoT → Open IoT Server Setup** from the Start Menu. Accept the Windows administrator prompt.
4. Create your first dashboard account using an email address and a password of at least 12 characters. No email delivery is required. The local setup page is `http://127.0.0.1:3001`; its authorization comes from the Start Menu shortcut, so opening that address directly will not authorize management.
5. Select **Open dashboard** and sign in. The default dashboard address is `http://localhost:3000/dashboard`.
6. The **Open IoT Server** Windows service starts automatically after boot. Closing the browser or terminal does not stop it. Use Windows Services to stop/restart it.

The setup credential is a local administrator capability, separate from dashboard accounts. Other dashboard users cannot change server settings, read logs or restore the entire database. Public account registration is disabled initially; enable **Allow other users to register** in server setup when needed. Account permissions and device ownership otherwise work as before.

## Connect ESP32 devices and other browsers

The default installation listens only on the server computer. In **Server Setup**:

- Enable **Allow devices on the local network**.
- Leave **Enable MQTT** checked if firmware uses MQTT. Configure the ESP32 with this computer's LAN address, port **1883**, and its existing device credentials.
- If using the dashboard from a phone or another computer, set **Dashboard address** to the exact server address, for example `http://192.168.1.50:3000`. Open that same address on all browsers. Do not add a trailing slash. Reserve the address in your router to keep it stable.
- Save settings. The dashboard briefly restarts. Devices reconnect using their existing credentials.

The installer adds a Windows firewall rule for TCP 3000/1883 on the **Private** network profile, restricted to the local subnet. It does not expose PostgreSQL or server management to the network. Your Windows network must be marked Private. No router port forwarding is needed for local use.

HTTP and MQTT are unencrypted in this local mode. For Internet access, use HTTPS through a separately configured tunnel/reverse proxy. Change **Dashboard address** to its exact HTTPS origin. Enabling **Google Home integration endpoints** only enables the backend; follow [Google Assistant setup](GOOGLE_ASSISTANT_SETUP.md) for OAuth, fulfillment and testing. Tunnel installation/startup is not bundled in this milestone.

When you change the dashboard origin, use **Open dashboard** inside setup; the initial Start Menu dashboard shortcut always points at localhost. Browser requests from an address that differs from the configured origin are rejected.

## Backups, restore and logs

- Choose **Create backup** in Server Setup. Each snapshot contains `database.dump`, `config.json` (including the encryption key), and an integrity/schema manifest.
- Backups are stored under `%ProgramData%\OpenIoT\backups\<id>`. Use administrator access to copy complete folders to another disk. They contain secrets: protect them like passwords. The installer does not upload backups anywhere.
- Choose **Restore**, then type `RESTORE`. This replaces current database contents, creates a recovery backup first, restarts the dashboard and signs users out. A failed PostgreSQL restore rolls back its transaction. Current connection settings are retained.
- The restore UI accepts snapshots from the same installation/key and checks hashes and migration compatibility. It does not import arbitrary SQL, ZIPs, or a different installation's encryption key. Moving to a new machine requires restoring the matching protected configuration as well; do not generate a new key for an existing device database.
- **Open IoT Server Logs** opens the service output log with administrator access. Other service logs are in `%ProgramData%\OpenIoT\logs`; PostgreSQL daily logs are under `postgres\log`. Never share `config.json` or backup folders when reporting an error.
- No automatic backup schedule or retention pruning is included yet. Copy snapshots off the server and remove old snapshots with administrator access when appropriate.

## Storage, upgrades and uninstall

Program files live under `%ProgramFiles%\Open IoT`. Database files, credentials, logs and backups live under `%ProgramData%\OpenIoT`. Only SYSTEM, Windows administrators and LocalService can access the data folder. The service runs as **LocalService**, not as an administrator. Its dedicated PostgreSQL listener uses `127.0.0.1:5440`, with a separate non-superuser application role.

An in-place installer upgrade stops the service before replacing files and applies migrations on startup. Existing keys are never regenerated. Back up before upgrading. PostgreSQL major upgrades and downgrade installs are not supported by this candidate.

Uninstall removes the service and firewall rule but **preserves the data folder**. Reinstalling reuses it. To permanently erase everything, uninstall first and deliberately remove `%ProgramData%\OpenIoT` as an administrator after preserving any needed backups.

An existing source/Docker installation is **not automatically imported**. The installer initially uses a separate database. Your existing `.env`, Docker volume and device database remain in place. Do not delete them. A supported source-to-installer import wizard is future work; do not assume a fresh installed dashboard already contains your old devices.

## Build the installer

On a Windows x64 build machine, install Node.js **24 LTS** and **Inno Setup 6**, then run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File installer/windows/build.ps1
```

The script installs locked npm dependencies, builds the web UI, downloads runtime binaries, stages production files and compiles the installer. Output is in `installer/windows/output`. Runtime/download/staging directories are ignored by Git.

PostgreSQL and WinSW downloads are pinned by SHA-256 in `vendor-lock.json`. These hashes were computed from the exact upstream HTTPS release downloads; they pin bytes, not publisher signatures. Node is matched to the builder's Node 24 version and verified against that release's upstream SHA-256 list. The Microsoft Visual C++ runtime is verified using its Microsoft Authenticode signature. The staged `BUILD-MANIFEST.json` records runtime versions/hashes. Included runtime/npm license files are retained.

The GitHub workflow builds on Windows Server 2022 and tests silent install, service identity/ACLs, first account creation, registration controls, settings restart, backup/restore, upgrade persistence and uninstall preservation. The artifact is uploaded only after those checks pass. A Windows 10/11 interactive/UAC/reboot test and code signing are still release gates before declaring this a stable desktop product.

## Troubleshooting

- **Setup page cannot connect:** wait for first startup, check **Open IoT Server** in Windows Services, then inspect service/database logs. Port conflicts or a failed runtime install can prevent startup.
- **Origin error after changing the address:** reopen the configured URL using **Open dashboard** in Server Setup. The browser origin must match exactly.
- **ESP32 cannot reach MQTT:** enable LAN access and MQTT, confirm the server's address and Private network profile, and use the device's current credentials.
- **Management says unauthorized:** reopen the elevated Start Menu setup shortcut. Do not copy the management URL or token to other users.
- **Upgrade or restore fails:** retain the database and logs. Do not delete the data directory to fix startup. A recovery snapshot is made before every restore.
