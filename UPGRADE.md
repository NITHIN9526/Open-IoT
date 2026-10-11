# Upgrading an existing installation

This repository ZIP is a complete source distribution, not an automatic upgrade installer. If your milestone installation already works, keep that working folder separate from this clean GitHub folder.

Before replacing any source, back up your project and PostgreSQL database. Preserve .env, .device.env, firmware secrets.h, compose.yaml, the Docker Compose project/volume identity and TOKEN_ENCRYPTION_KEY. Starting Compose from a new folder can create a different empty volume; it does not migrate your existing database.

For a manual source upgrade:

1. Stop the backend and simulator. Record existing config and save a database backup.
2. Copy reviewed source changes into the existing project. Keep private config and its Docker settings, and never replace applied migrations with changed contents.
3. Review new variables in .env.example and add only those required. Setup will not modify your existing .env.
4. Run npm ci, start the existing PostgreSQL service, run npm run migrate, then npm run dev.
5. Use the same APP_ORIGIN and verify accounts/devices, manual control, schedules and rules.

Existing Milestone 5 installations already have SQL001–004. Version 5.1 manuals need no new database migration or firmware upload. The complete distribution defaults fresh PostgreSQL mapping to 5433; retain your own working mapping and DATABASE_URL.

Do not run docker compose down -v, regenerate the encryption key, or change applied SQL checksums as an upgrade workaround. Roll back source using your backup. Restore a database backup only as a deliberate recovery action because it discards newer data.
