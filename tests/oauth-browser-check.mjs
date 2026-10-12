import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { createTestDb } from "./database.js";
import { hashToken } from "../server/security.js";
const db = await createTestDb();
let app;
const server = createServer((req, res) => app(req, res));
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
app = await createApp({
  db,
  origin,
  encryptionKey: randomBytes(32),
  bcryptRounds: 4,
  disableLimits: true,
  voice: {},
});
let browser;
const callbackServer = createServer((req, res) => res.end("Callback reached"));
callbackServer.listen(0, "127.0.0.1");
await once(callbackServer, "listening");
try {
  await fetch(origin + "/api/auth/register", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Browser tester",
      email: "browser@example.com",
      password: "browser-test-password",
    }),
  });
  const callback = `http://127.0.0.1:${callbackServer.address().port}/r/test-project`;
  await db.query(
    "INSERT INTO oauth_clients(id,provider,name,secret_hash,redirect_uris) VALUES($1,$2,$3,$4,$5)",
    [
      "browser-google",
      "google",
      "Google",
      hashToken("test-client-secret"),
      [callback],
    ],
  );
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let postedOrigin, callbackUrl;
  const failures = [];
  page.on("console", (m) => {
    if (m.type() === "error") failures.push(m.text());
  });
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/oauth/authorize"))
      postedOrigin = r.headers().origin;
    if (r.url().startsWith(callback)) callbackUrl = r.url();
  });
  await page.goto(
    origin +
      "/oauth/authorize?" +
      new URLSearchParams({
        client_id: "browser-google",
        redirect_uri: callback,
        state: "state-from-google",
        scope: "devices:control",
        response_type: "code",
      }),
  );
  await page.locator("[name=email]").fill("browser@example.com");
  await page.locator("[name=password]").fill("browser-test-password");
  await page.getByRole("button", { name: "Agree and link" }).click();
  await page.waitForURL(callback + "**", { timeout: 5000 }).catch(() => {});

  assert.equal(
    postedOrigin,
    origin,
    "Native form POST must preserve same-origin Origin",
  );
  assert.ok(
    callbackUrl,
    "Validated Google callback must not be blocked by CSP: " +
      failures.join(" | "),
  );
  assert.equal(
    new URL(callbackUrl).searchParams.get("state"),
    "state-from-google",
  );
  assert.match(
    new URL(callbackUrl).searchParams.get("code"),
    /^[A-Za-z0-9_-]{43}$/,
  );
  assert.equal(failures.length, 0, failures.join("\n"));
  console.log(
    "OAuth browser login preserved Origin and reached Google callback.",
  );
} finally {
  await browser?.close();
  callbackServer.closeAllConnections();
  await new Promise((r) => callbackServer.close(r));
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await db.raw.close();
}
