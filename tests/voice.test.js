import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../server/app.js";
import { createTestDb } from "./database.js";
import { hashToken } from "../server/security.js";
import { events } from "../server/events.js";

test("voice OAuth consent, PKCE, isolation, ACKs, retries, expiry and revocation", async () => {
  const db = await createTestDb(),
    origin = "http://localhost:5173",
    bridge = "b".repeat(43),
    clientSecret = "s".repeat(43),
    redirect = "https://example.com/callback";
  const app = await createApp({
    db,
    origin,
    encryptionKey: randomBytes(32),
    bcryptRounds: 4,
    disableLimits: true,
    voice: { bridgeSecret: bridge },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const raw = (path, options = {}) =>
    fetch(base + path, { redirect: "manual", ...options });
  const json = async (path, body, headers = {}, method = "POST") => {
    const r = await raw(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...headers,
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json(), headers: r.headers };
  };
  const form = async (path, body, headers = {}) =>
    raw(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...headers,
      },
      body: new URLSearchParams(body),
    });
  let listener;
  try {
    for (const p of ["google", "alexa"])
      await db.query("INSERT INTO oauth_clients VALUES($1,$2,$3,$4,$5,true)", [
        p,
        p,
        p,
        hashToken(clientSecret),
        [redirect],
      ]);
    const account = await json("/api/auth/register", {
      name: "Voice tester",
      email: "voice@example.com",
      password: "test-password-123",
    });
    const auth = {
      Cookie: account.headers.get("set-cookie").split(";")[0],
      "X-CSRF-Token": account.body.csrfToken,
    };
    const other = await json("/api/auth/register", {
      name: "Other",
      email: "other@example.com",
      password: "test-password-123",
    });
    const otherAuth = {
      Cookie: other.headers.get("set-cookie").split(";")[0],
      "X-CSRF-Token": other.body.csrfToken,
    };
    const made = await json(
        "/api/devices",
        { name: "Desk lamp", deviceType: "simulator" },
        auth,
      ),
      id = made.body.device.id,
      deviceToken = made.body.token;
    const sync = (body) =>
      json("/api/device/sync", body, {
        Authorization: `Bearer ${deviceToken}`,
      });
    assert.equal(
      (
        await json(
          `/api/voice/devices/${id}`,
          { powerPin: "V1", brightnessPin: "V2" },
          otherAuth,
          "PUT",
        )
      ).status,
      404,
    );
    assert.equal(
      (await json(`/api/voice/devices/${id}`, { powerPin: "V0" }, auth, "PUT"))
        .status,
      400,
    );
    assert.equal(
      (
        await json(
          `/api/voice/devices/${id}`,
          { powerPin: "V1", brightnessPin: "V2" },
          auth,
          "PUT",
        )
      ).status,
      200,
    );
    const verifier = "v".repeat(43),
      challenge = createHash("sha256").update(verifier).digest("base64url");
    async function authorize(provider = "google") {
      const query = new URLSearchParams({
        client_id: provider,
        redirect_uri: redirect,
        state: "original state",
        response_type: "code",
        scope: "devices:control",
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      const r = await raw("/oauth/authorize?" + query);
      assert.equal(r.status, 200);
      const html = await r.text(),
        flow = html.match(/name="flow" value="([^"]+)"/)[1],
        Cookie = r.headers.get("set-cookie").split(";")[0];
      assert.equal(
        (
          await form(
            "/oauth/authorize",
            {
              flow,
              decision: "allow",
              email: "voice@example.com",
              password: "test-password-123",
            },
            { Cookie, Origin: "https://evil.example" },
          )
        ).status,
        403,
      );
      const posted = await form(
        "/oauth/authorize",
        {
          flow,
          decision: "allow",
          email: "voice@example.com",
          password: "test-password-123",
        },
        { Cookie, Origin: origin },
      );
      assert.equal(posted.status, 303);
      const loc = new URL(posted.headers.get("location"));
      assert.equal(loc.searchParams.get("state"), "original state");
      return loc.searchParams.get("code");
    }
    const code = await authorize();
    const exchange = {
      client_id: "google",
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      code_verifier: verifier,
    };
    assert.equal(
      (
        await form("/oauth/token", {
          ...exchange,
          code_verifier: "x".repeat(43),
        })
      ).status,
      400,
    );
    const tokenReply = await form("/oauth/token", exchange);
    assert.equal(tokenReply.status, 200);
    const tokens = await tokenReply.json();
    assert.equal((await form("/oauth/token", exchange)).status, 400);
    assert.equal(
      (
        await form("/oauth/token", {
          client_id: "alexa",
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
        })
      ).status,
      400,
    );
    const refresh = await form("/oauth/token", {
      client_id: "google",
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    });
    assert.equal(refresh.status, 200);
    const google = (
      intent,
      payload = {},
      requestId = randomUUID(),
      token = tokens.access_token,
    ) =>
      json(
        "/voice/google",
        {
          requestId,
          inputs: [{ intent: "action.devices." + intent, payload }],
        },
        { Authorization: "Bearer " + token },
      );
    assert.equal((await google("SYNC")).body.payload.devices.length, 1);
    const unknown = await google("QUERY", { devices: [{ id: randomUUID() }] });
    assert.equal(
      Object.values(unknown.body.payload.devices)[0].errorCode,
      "deviceNotFound",
    );
    await sync({ telemetry: [{ pin: "V0", value: 24 }] });
    const cmdId = randomUUID();
    const execute = (rid, value = true) =>
      google(
        "EXECUTE",
        {
          commands: [
            {
              devices: [{ id }],
              execution: [
                {
                  command: "action.devices.commands.OnOff",
                  params: { on: value },
                },
              ],
            },
          ],
        },
        rid,
      );
    let ackPromise;
    listener = () => {
      ackPromise = (async () => {
        const s = await sync({});
        await sync({
          acknowledgements: s.body.commands.map((c) => ({
            id: c.id,
            value: c.value,
          })),
        });
      })();
    };
    events.on("command", listener);
    assert.equal(
      (await execute(cmdId)).body.payload.commands[0].status,
      "SUCCESS",
    );
    await ackPromise;
    assert.equal(
      (await execute(cmdId)).body.payload.commands[0].status,
      "SUCCESS",
    );
    await ackPromise;
    const {
      rows: [count],
    } = await db.query(
      "SELECT count(*)::int AS n FROM device_commands WHERE device_id=$1",
      [id],
    );
    assert.equal(count.n, 1);
    assert.equal(
      (await execute(cmdId, false)).body.payload.commands[0].status,
      "ERROR",
    );
    const acode = await authorize("alexa");
    const at = await (
      await form("/oauth/token", {
        ...exchange,
        client_id: "alexa",
        code: acode,
      })
    ).json();
    const alexa = async (
      namespace,
      name,
      token = at.access_token,
      withBridge = true,
    ) =>
      json(
        "/voice/alexa",
        {
          directive: {
            header: {
              namespace,
              name,
              messageId: randomUUID(),
              payloadVersion: "3",
              correlationToken: "correlation",
            },
            endpoint: { endpointId: id, scope: { type: "BearerToken", token } },
            payload: { scope: { type: "BearerToken", token } },
          },
        },
        withBridge ? { "X-OpenIoT-Bridge": bridge } : {},
      );
    // Query uses actual device ACK data; Google requires both mapped states known.
    assert.equal(
      (await alexa("Alexa.PowerController", "TurnOff")).body.event.header.name,
      "Response",
    );
    await ackPromise;
    assert.equal(
      (await alexa("Alexa", "ReportState")).body.context.properties[0].value,
      "OFF",
    );
    assert.equal(
      (await alexa("Alexa.Discovery", "Discover")).body.event.payload.endpoints
        .length,
      1,
    );
    assert.equal(
      (await alexa("Alexa", "ReportState", tokens.access_token)).body.event
        .payload.type,
      "INVALID_AUTHORIZATION_CREDENTIAL",
    );
    assert.equal(
      (await google("SYNC", {}, randomUUID(), at.access_token)).status,
      401,
    );
    events.off("command", listener);
    listener = null;
    assert.equal(
      (await execute(randomUUID(), true)).body.payload.commands[0].status,
      "ERROR",
    );
    assert.equal((await sync({})).body.commands.length, 0);
    const revoked = await json(
      "/api/account/password",
      { password: "test-password-123", newPassword: "another-password-456" },
      auth,
      "PUT",
    );
    assert.equal(revoked.status, 200);
    assert.equal((await google("SYNC")).status, 401);
    assert.equal(
      (
        await form("/oauth/token", {
          client_id: "google",
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
        })
      ).status,
      400,
    );
  } finally {
    if (listener) events.off("command", listener);
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await db.raw.close();
  }
});
