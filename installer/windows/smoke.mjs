// Runs against an installed, isolated Windows CI VM. Never prints configuration or tokens.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const config = JSON.parse(await readFile(join(process.env.ProgramData, "OpenIoT", "config.json"), "utf8"));
const headers = { Authorization: `Bearer ${config.managementToken}`, Origin: "http://127.0.0.1:3001", "Content-Type": "application/json" };
async function manage(path, method = "GET", body) {
  const response = await fetch("http://127.0.0.1:3001/api/" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `Management ${path}: HTTP ${response.status}`);
  return response.json();
}
let ready = false;
for (let i = 0; i < 120; i++) {
  try { await manage("status"); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
}
assert.ok(ready, "Installed service did not become ready within two minutes");
if (process.argv.includes("--preserved")) {
  const status = await manage("status");
  assert.ok(status.setupComplete);
  assert.ok(status.backups.length >= 2);
  console.log("Upgrade/reinstall preserved account and backups.");
  process.exit(0);
}
assert.equal((await fetch("http://127.0.0.1:3001/api/status")).status, 401);
const owner = { name: "CI Owner", email: "owner@example.com", password: randomUUID() };
await manage("setup", "POST", owner);
const auth = (path, body) => fetch("http://127.0.0.1:3000/api/auth/" + path, { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify(body) });
assert.equal((await auth("login", { email: owner.email, password: owner.password })).status, 200);
assert.equal((await auth("register", owner)).status, 403);
const snapshot = await manage("backups", "POST", {});
const settings = (await manage("status")).settings;
await manage("settings", "PUT", { ...settings, registrationEnabled: true });
const second = { name: "CI Second", email: "second@example.com", password: randomUUID() };
assert.equal((await auth("register", second)).status, 201);
await manage("restore", "POST", { id: snapshot.id, confirm: "RESTORE" });
assert.equal((await auth("login", { email: second.email, password: second.password })).status, 401);
assert.equal((await auth("login", { email: owner.email, password: owner.password })).status, 200);
assert.ok((await manage("status")).backups.length >= 2);
await manage("settings", "PUT", settings);
console.log("Installed service: setup, authentication, settings restart, backup and restore passed.");
