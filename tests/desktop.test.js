import test from "node:test";
import { request as httpRequest } from "node:http";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { newConfig, prepare, loadConfig, saveConfig, settingsSchema, appEnvironment, managementOrigin } from "../server/desktop/config.js";
import { createManagementApp } from "../server/desktop/management.js";
import { createApp } from "../server/app.js";
import { createTestDb } from "./database.js";

test("installed configuration preserves keys across upgrades and validates settings", async () => {
  const folder = await mkdtemp(join(tmpdir(), "openiot-desktop-"));
  try {
    const first = await prepare(folder);
    assert.equal(first.managementToken.length, 64);
    assert.notEqual(first.managementToken, first.databasePassword);
    assert.deepEqual(await prepare(folder), first);
    assert.equal(appEnvironment(first, {}).HOST, "127.0.0.1");
    assert.equal(appEnvironment(first, {}).REGISTRATION_ENABLED, "false");
    assert.equal(settingsSchema.safeParse({ ...first.settings, origin: "http://localhost:3000/path" }).success, false);
    assert.equal(settingsSchema.safeParse({ ...first.settings, origin: "javascript:alert(1)" }).success, false);
    const changed = { ...first, settings: { ...first.settings, lanAccess: true, origin: "https://iot.example.com" } };
    await saveConfig(folder, changed);
    assert.deepEqual(await loadConfig(folder), changed);
    assert.equal(appEnvironment(changed, {}).NODE_ENV, "production");
    assert.equal(appEnvironment(changed, {}).HOST, "0.0.0.0");
    assert.equal(JSON.parse(await readFile(join(folder, "config.json"), "utf8")).encryptionKey, first.encryptionKey);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test("local management requires its credential, exact host/origin, and one-time setup", async t => {
  const db = await createTestDb(), config = newConfig();
  t.after(() => db.raw.close());
  let changed, restored, finishBackup;
  const controller = {
    status: async () => ({ settings: config.settings, running: true, backups: [], dataDir: "protected" }),
    settings: async settings => { changed = settings; },
    backup: () => new Promise(resolve => { finishBackup = resolve; }),
    restore: async id => { restored = id; }, stop: () => {},
  };
  const server = createManagementApp({ token: config.managementToken, db, controller, bcryptRounds: 4 }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { host: "127.0.0.1:3001", authorization: `Bearer ${config.managementToken}`, origin: managementOrigin, "content-type": "application/json" };
  const request = (path, method = "GET", body, overrides = {}) => new Promise((resolve, reject) => {
    const req = httpRequest(url + path, { method, headers: { ...headers, ...overrides } }, res => {
      let text = ""; res.setEncoding("utf8"); res.on("data", chunk => text += chunk);
      res.on("end", () => resolve({ status: res.statusCode, json: async () => JSON.parse(text) }));
    });
    req.on("error", reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  assert.equal((await request("/api/status", "GET", undefined, { authorization: "" })).status, 401);
  assert.equal((await request("/api/status", "GET", undefined, { host: "attacker.example:3001" })).status, 403);
  assert.equal((await request("/api/setup", "POST", {}, { origin: "https://attacker.example" })).status, 403);
  const firstStatus = await (await request("/api/status")).json();
  assert.equal(firstStatus.setupComplete, false);
  assert.equal("managementToken" in firstStatus, false);
  assert.equal((await request("/api/setup", "POST", { name: "Owner", email: "owner@example.com", password: "short" })).status, 400);
  const account = { name: "Owner", email: "owner@example.com", password: "a-test-password-12345" };
  const results = await Promise.all([request("/api/setup", "POST", account), request("/api/setup", "POST", account)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  assert.equal((await (await request("/api/status")).json()).setupComplete, true);
  assert.equal((await request("/api/setup", "POST", account)).status, 409);
  assert.equal((await request("/api/settings", "PUT", { ...config.settings, lanAccess: true })).status, 200);
  assert.equal(changed.lanAccess, true);
  assert.equal((await request("/api/restore", "POST", { id: "../../etc", confirm: "RESTORE" })).status, 400);
  assert.equal((await request("/api/restore", "POST", { id: "ccf56c42-9d83-4a39-99a2-00cd2eb6d1ab", confirm: "no" })).status, 400);
  assert.equal(restored, undefined);
  const pendingBackup = request("/api/backups", "POST", {});
  while (!finishBackup) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await request("/api/settings", "PUT", config.settings)).status, 409);
  finishBackup({ id: "backup" });
  assert.equal((await pendingBackup).status, 201);
  const app = await createApp({ db, encryptionKey: Buffer.from(config.encryptionKey, "base64"), registrationEnabled: false, bcryptRounds: 4, disableLimits: true });
  const dashboard = app.listen(0, "127.0.0.1");
  await once(dashboard, "listening");
  t.after(() => new Promise(resolve => { dashboard.close(resolve); dashboard.closeAllConnections(); }));
  const authUrl = `http://127.0.0.1:${dashboard.address().port}/api/auth/`;
  const authHeaders = { origin: "http://localhost:5173", "content-type": "application/json" };
  assert.equal((await fetch(authUrl + "register", { method: "POST", headers: authHeaders, body: JSON.stringify(account) })).status, 403);
  assert.equal((await fetch(authUrl + "login", { method: "POST", headers: authHeaders, body: JSON.stringify({ email: account.email, password: account.password }) })).status, 200);
});
