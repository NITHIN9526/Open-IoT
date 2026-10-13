import { execFile, fork } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { readFile, writeFile, mkdir, rm, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
import { z } from "zod";
import { loadConfig, saveConfig, databaseUrl, appEnvironment, managementOrigin } from "./config.js";
import { createManagementApp } from "./management.js";

const execute = promisify(execFile);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
export async function startInstalledServer({ root, dataDir }) {
  let config = await loadConfig(dataDir);
  const pgBin = join(root, "runtime", "pgsql", "bin");
  const cluster = join(dataDir, "postgres");
  const pg = (name, args, options = {}) => execute(join(pgBin, name + ".exe"), args, {
    windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024, ...options,
  });
  let child, manager, db, stopping = false, intentionalStop = false, starting = false;
  let ownsPostgres = false;
  async function stopApp() {
    const current = child;
    if (!current) return;
    intentionalStop = true;
    const ended = once(current, "exit");
    if (current.connected) current.send("shutdown");
    const timer = setTimeout(() => current.kill(), 12000);
    try { await ended; } finally { clearTimeout(timer); child = null; intentionalStop = false; }
  }
  async function startApp() {
    starting = true;
    try {
    child = fork(join(root, "server", "index.js"), [], { cwd: root, env: appEnvironment(config), windowsHide: true, stdio: ["ignore", "inherit", "inherit", "ipc"] });
    child.on("error", () => { console.error("Dashboard process could not start."); child = null; if (!starting) void stop(1); });
    child.on("exit", () => {
      child = null;
      if (!intentionalStop && !stopping && !starting) { console.error("Dashboard process exited unexpectedly."); void stop(1); }
    });
    // Do not report success before the new app is actually listening.
    for (let attempt = 0; attempt < 60; attempt++) {
      if (!child || stopping) throw Error("Dashboard did not start.");
      try {
        const response = await fetch("http://127.0.0.1:3000/api/health", { signal: AbortSignal.timeout(1000) });
        if (response.ok) return;
      } catch { /* readiness retry */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw Error("Dashboard readiness timed out.");
    } finally { starting = false; }
  }
  async function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 45000);
    try {
      if (manager) { manager.close(); manager.closeIdleConnections(); }
      await stopApp();
      if (db) await db.end();
      if (ownsPostgres) await pg("pg_ctl", ["-D", cluster, "-m", "fast", "-w", "-t", "20", "stop"]);
    } catch { code = 1; console.error("Shutdown did not finish cleanly; see PostgreSQL logs."); }
    clearTimeout(deadline);
    process.exit(code);
  }
  try {
    if (!existsSync(join(cluster, "PG_VERSION"))) {
      const pwfile = join(dataDir, "init-password.txt");
      await writeFile(pwfile, config.postgresPassword + "\n", { mode: 0o600 });
      try {
        await pg("initdb", ["-D", cluster, "-U", "openiot_admin", "--pwfile=" + pwfile, "--auth-host=scram-sha-256", "--auth-local=scram-sha-256", "--encoding=UTF8", "--locale=C"]);
      } finally { await rm(pwfile, { force: true }); }
    }
    if ((await readFile(join(cluster, "PG_VERSION"), "utf8")).trim() !== "17") throw Error("Unsupported PostgreSQL major version. Back up before upgrading.");
    // A previous wrapper crash can leave this dedicated cluster running.
    let running = false;
    try { await pg("pg_ctl", ["-D", cluster, "status"]); running = true; } catch { /* start below */ }
    if (!running) await pg("pg_ctl", ["-D", cluster, "-l", join(dataDir, "logs", "postgres-startup.log"), "-w", "-t", "60", "-o", "-h 127.0.0.1 -p 5440 -c logging_collector=on -c log_rotation_age=1d -c log_truncate_on_rotation=on -c log_filename=postgres-%a.log", "start"]);
    ownsPostgres = true;
    const admin = new Pool({ host: "127.0.0.1", port: 5440, user: "openiot_admin", password: config.postgresPassword, database: "postgres", connectionTimeoutMillis: 5000 });
    try {
      if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='openiot'")).rows.length) {
        // Password is validated as 64 hexadecimal characters, never user SQL.
        await admin.query(`CREATE ROLE openiot LOGIN PASSWORD '${config.databasePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
      }
      if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='openiot'")).rows.length) await admin.query("CREATE DATABASE openiot OWNER openiot");
    } finally { await admin.end(); }
    await execute(process.execPath, [join(root, "scripts", "migrate.js")], { cwd: root, env: appEnvironment(config), windowsHide: true, timeout: 120000 });
    db = new Pool({ connectionString: databaseUrl(config), connectionTimeoutMillis: 5000 });
    db.on("error", error => console.error("Management database error:", error.code));
    const backupRoot = join(dataDir, "backups");
    const backupEnv = () => ({ ...process.env, PGPASSWORD: config.databasePassword });
    const pgArgs = ["-h", "127.0.0.1", "-p", "5440", "-U", "openiot", "-d", "openiot", "--no-password"];
    async function backup() {
      const id = randomUUID(), folder = join(backupRoot, id), temporary = folder + ".partial";
      await mkdir(temporary);
      try {
        await pg("pg_dump", [...pgArgs, "-Fc", "--no-owner", "--no-acl", "-f", join(temporary, "database.dump")], { env: backupEnv() });
        await writeFile(join(temporary, "config.json"), JSON.stringify(config, null, 2), { mode: 0o600 });
        const manifest = { version: 1, id, createdAt: new Date().toISOString(), migrations: (await db.query("SELECT name,checksum FROM schema_migrations ORDER BY name")).rows, databaseSha256: digest(await readFile(join(temporary, "database.dump"))), keySha256: digest(config.encryptionKey) };
        await writeFile(join(temporary, "manifest.json"), JSON.stringify(manifest, null, 2));
        await rename(temporary, folder);
        return manifest;
      } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
    }
    async function listBackups() {
      const result = [];
      for (const name of await readdir(backupRoot)) {
        if (!z.string().uuid().safeParse(name).success) continue;
        try { const m = JSON.parse(await readFile(join(backupRoot, name, "manifest.json"), "utf8")); result.push({ id: name, createdAt: m.createdAt }); } catch { /* incomplete backups are never offered */ }
      }
      return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const controller = {
      async status() { return { settings: config.settings, running: Boolean(child), backups: await listBackups(), dataDir }; },
      async settings(settings) {
        const previous = config;
        await stopApp();
        try {
          config = { ...config, settings };
          await saveConfig(dataDir, config);
          await startApp();
        } catch (error) {
          config = previous;
          await saveConfig(dataDir, config);
          if (!stopping) { await stopApp(); await startApp(); }
          throw error;
        }
      },
      backup,
      async restore(id) {
        // Only complete snapshots created on this installation are accepted.
        z.string().uuid().parse(id);
        const folder = join(backupRoot, id);
        const manifest = JSON.parse(await readFile(join(folder, "manifest.json"), "utf8"));
        const dump = join(folder, "database.dump");
        if (manifest.version !== 1 || manifest.id !== id || manifest.keySha256 !== digest(config.encryptionKey) || manifest.databaseSha256 !== digest(await readFile(dump))) throw Error("Backup integrity or installation key mismatch.");
        if (!Array.isArray(manifest.migrations)) throw Error("Backup schema metadata is missing.");
        const installedMigrations = new Set(await readdir(join(root, "sql")));
        for (const migration of manifest.migrations) {
          if (!installedMigrations.has(migration.name)) throw Error("Backup requires a different server version.");
          if (digest(await readFile(join(root, "sql", migration.name))) !== migration.checksum) throw Error("Backup requires a different server version.");
        }
        await pg("pg_restore", ["--list", dump]);
        await stopApp();
        try {
          await backup(); // Recovery point before every destructive restore.
          await pg("pg_restore", [...pgArgs, "--clean", "--if-exists", "--no-owner", "--no-acl", "--single-transaction", "--exit-on-error", dump], { env: backupEnv() });
          // Upgrade a snapshot from an older application schema before reopening it.
          await execute(process.execPath, [join(root, "scripts", "migrate.js")], { cwd: root, env: appEnvironment(config), windowsHide: true, timeout: 120000 });
          await db.query("DELETE FROM sessions");
        } finally { await startApp(); }
      },
      stop,
    };
    await startApp();
    manager = createManagementApp({ token: config.managementToken, db, controller }).listen(3001, "127.0.0.1");
    await once(manager, "listening");
    console.log(`Open IoT Server ready. Local administration: ${managementOrigin}`);
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => void stop());
  } catch (error) {
    console.error("Installed server startup failed:", error.code ?? error.name, "Check the service and PostgreSQL logs.");
    await stop(1);
  }
}
