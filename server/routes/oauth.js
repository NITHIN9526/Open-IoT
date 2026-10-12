import { Router, urlencoded } from "express";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { randomToken, hashToken, tokenPattern, equal } from "../security.js";
import { oauthError, oauthErrors } from "../voice/auth.js";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const str = (x, max = 2048) =>
  typeof x === "string" && x.length <= max ? x : "";
export function oauthRouter({ db, tx, origin, limit }) {
  const r = Router(),
    secure = origin.startsWith("https://"),
    cookie = secure ? "__Secure-openiot_link" : "openiot_link";
  const opts = {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/oauth",
    maxAge: 600000,
  };
  const dummy = bcrypt.hashSync(randomToken(), 12);
  r.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "Referrer-Policy": "same-origin",
    });
    next();
  });
  r.use(urlencoded({ extended: false, limit: "8kb", parameterLimit: 20 }));
  r.get("/authorize", limit(30, 600000), async (req, res) => {
    const q = req.query;
    const {
      rows: [c],
    } = await db.query("SELECT * FROM oauth_clients WHERE id=$1 AND enabled", [
      str(q.client_id, 100),
    ]);
    // Never redirect an invalid client/redirect URI.
    if (!c || !c.redirect_uris.includes(q.redirect_uri))
      throw oauthError("invalid_request");
    if (
      q.response_type !== "code" ||
      !str(q.state) ||
      (q.scope !== undefined && q.scope !== "devices:control")
    )
      throw oauthError("invalid_request");
    if (
      (q.code_challenge !== undefined ||
        q.code_challenge_method !== undefined) &&
      (q.code_challenge_method !== "S256" ||
        !tokenPattern.test(q.code_challenge ?? ""))
    )
      throw oauthError("invalid_request");
    // Native forms need their same-origin Origin header, and Chrome applies
    // form-action to the subsequent OAuth redirect. Allow only this validated
    // callback origin; retain every other Helmet CSP directive.
    const csp = res.get("Content-Security-Policy");
    if (csp) {
      res.set(
        "Content-Security-Policy",
        csp.replace(
          /form-action[^;]*/,
          `form-action 'self' ${new URL(q.redirect_uri).origin}`,
        ),
      );
    }
    const flow = randomToken(),
      browser = randomToken();
    await db.query(
      `INSERT INTO oauth_interactions(id_hash,browser_hash,client_id,redirect_uri,state,challenge)
      VALUES($1,$2,$3,$4,$5,$6)`,
      [
        hashToken(flow),
        hashToken(browser),
        c.id,
        q.redirect_uri,
        q.state,
        q.code_challenge ?? null,
      ],
    );
    res.cookie(cookie, browser, opts);
    res.type("html")
      .send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Link Open IoT</title><main><h1>Link Open IoT to ${esc(c.name)}</h1>
      <p>Sign in with your Open IoT account. By signing in and choosing Agree and link, you authorize ${c.provider === "google" ? "Google" : "Amazon Alexa"} to view and control your voice-enabled devices, including future devices you enable.</p>
      <p>Device names, connectivity, power and brightness states are shared. Device firmware tokens and passwords are never shared.</p>
      <form method="post" action="/oauth/authorize"><input type="hidden" name="flow" value="${flow}">
      <p><label>Email <input type="email" name="email" autocomplete="username" required maxlength="254"></label></p>
      <p><label>Password <input type="password" name="password" autocomplete="current-password" required></label></p>
      <button name="decision" value="allow">Agree and link</button>
      <button name="decision" value="deny" formnovalidate>Cancel</button></form>
      <p>You can unlink in your voice assistant app or through Open IoT's linked-account API.</p></main></html>`);
  });
  r.post("/authorize", limit(10, 900000), async (req, res) => {
    if (
      req.get("Origin") !== origin ||
      !req.is("application/x-www-form-urlencoded")
    )
      throw oauthError("invalid_request", 403);
    const b = req.body;
    if (
      !tokenPattern.test(b.flow ?? "") ||
      !tokenPattern.test(req.cookies[cookie] ?? "")
    )
      throw oauthError("invalid_request", 403);
    const {
      rows: [flow],
    } = await db.query(
      `SELECT i.* FROM oauth_interactions i JOIN oauth_clients c ON c.id=i.client_id
      WHERE i.id_hash=$1 AND i.browser_hash=$2 AND i.expires_at>now() AND c.enabled`,
      [hashToken(b.flow), hashToken(req.cookies[cookie])],
    );
    if (!flow) throw oauthError("invalid_request", 403);
    if (!["allow", "deny"].includes(b.decision))
      throw oauthError("invalid_request");
    let user;
    if (b.decision === "allow") {
      const email = str(b.email, 254).trim().toLowerCase(),
        password = str(b.password, 72);
      if (!password || Buffer.byteLength(password) > 72)
        throw oauthError("access_denied", 401);
      ({
        rows: [user],
      } = await db.query("SELECT * FROM users WHERE email=$1", [email]));
      if (
        !(await bcrypt.compare(password, user?.password_hash ?? dummy)) ||
        !user
      )
        throw oauthError("access_denied", 401);
    }
    const code = randomToken();
    await tx(async (cx) => {
      if (user) {
        const {
          rows: [current],
        } = await cx.query(
          "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
          [user.id],
        );
        if (current?.password_hash !== user.password_hash)
          throw oauthError("access_denied", 401);
      }
      const { rows } = await cx.query(
        "DELETE FROM oauth_interactions WHERE id_hash=$1 AND expires_at>now() RETURNING id_hash",
        [hashToken(b.flow)],
      );
      if (!rows.length) throw oauthError("invalid_request");
      const {
        rows: [client],
      } = await cx.query(
        "SELECT * FROM oauth_clients WHERE id=$1 AND enabled FOR SHARE",
        [flow.client_id],
      );
      if (!client?.redirect_uris.includes(flow.redirect_uri))
        throw oauthError("invalid_request");
      if (user) {
        const {
          rows: [g],
        } = await cx.query(
          "INSERT INTO oauth_grants(user_id,client_id) VALUES($1,$2) RETURNING id",
          [user.id, flow.client_id],
        );
        await cx.query(
          "INSERT INTO oauth_codes(token_hash,grant_id,redirect_uri,challenge) VALUES($1,$2,$3,$4)",
          [hashToken(code), g.id, flow.redirect_uri, flow.challenge],
        );
      }
    });
    const redirect = new URL(flow.redirect_uri);
    redirect.searchParams.set(
      user ? "code" : "error",
      user ? code : "access_denied",
    );
    redirect.searchParams.set("state", flow.state);
    res.clearCookie(cookie, { ...opts, maxAge: undefined });
    const redirectCsp = res.get("Content-Security-Policy");
    if (redirectCsp) {
      res.set(
        "Content-Security-Policy",
        redirectCsp.replace(
          /form-action[^;]*/,
          `form-action 'self' ${redirect.origin}`,
        ),
      );
    }
    res.redirect(303, redirect.href);
  });
  r.post("/token", limit(120), async (req, res) => {
    if (!req.is("application/x-www-form-urlencoded"))
      throw oauthError("invalid_request");
    const b = req.body;
    let id = b.client_id,
      secret = b.client_secret;
    const auth = req.get("Authorization");
    if (auth) {
      if (
        id !== undefined ||
        secret !== undefined ||
        !auth.startsWith("Basic ")
      )
        throw oauthError("invalid_client", 401);
      const raw = Buffer.from(auth.slice(6), "base64").toString(),
        at = raw.indexOf(":");
      if (at < 0) throw oauthError("invalid_client", 401);
      try {
        id = decodeURIComponent(raw.slice(0, at));
        secret = decodeURIComponent(raw.slice(at + 1));
      } catch {
        throw oauthError("invalid_client", 401);
      }
    }
    const result = await tx(async (cx) => {
      const {
        rows: [client],
      } = await cx.query(
        "SELECT * FROM oauth_clients WHERE id=$1 AND enabled FOR SHARE",
        [str(id, 100)],
      );
      if (
        !client ||
        !str(secret, 512) ||
        !equal(hashToken(secret), client.secret_hash)
      )
        throw oauthError("invalid_client", 401);
      let grant;
      if (b.grant_type === "authorization_code") {
        if (!tokenPattern.test(b.code ?? "")) throw oauthError("invalid_grant");
        const {
          rows: [code],
        } = await cx.query(
          `SELECT c.*,g.client_id,g.revoked_at FROM oauth_codes c JOIN oauth_grants g ON g.id=c.grant_id
          WHERE c.token_hash=$1 AND c.expires_at>now() FOR UPDATE OF c,g`,
          [hashToken(b.code)],
        );
        if (
          !code ||
          code.client_id !== id ||
          code.revoked_at ||
          code.redirect_uri !== b.redirect_uri
        )
          throw oauthError("invalid_grant");
        if (
          code.challenge &&
          (!/^[A-Za-z0-9._~-]{43,128}$/.test(b.code_verifier ?? "") ||
            !equal(
              createHash("sha256").update(b.code_verifier).digest("base64url"),
              code.challenge,
            ))
        )
          throw oauthError("invalid_grant");
        await cx.query("DELETE FROM oauth_codes WHERE token_hash=$1", [
          hashToken(b.code),
        ]);
        grant = code.grant_id;
      } else if (b.grant_type === "refresh_token") {
        if (!tokenPattern.test(b.refresh_token ?? ""))
          throw oauthError("invalid_grant");
        const {
          rows: [t],
        } = await cx.query(
          `SELECT t.grant_id FROM oauth_refresh_tokens t JOIN oauth_grants g ON g.id=t.grant_id
          WHERE t.token_hash=$1 AND t.expires_at>now() AND g.client_id=$2 AND g.revoked_at IS NULL FOR UPDATE OF g`,
          [hashToken(b.refresh_token), id],
        );
        if (!t) throw oauthError("invalid_grant");
        grant = t.grant_id;
      } else throw oauthError("unsupported_grant_type");
      if (b.scope !== undefined && b.scope !== "devices:control")
        throw oauthError("invalid_scope");
      const access = randomToken();
      await cx.query(
        "INSERT INTO oauth_access_tokens(token_hash,grant_id) VALUES($1,$2)",
        [hashToken(access), grant],
      );
      const tokens = {
        access_token: access,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "devices:control",
      };
      if (b.grant_type === "authorization_code") {
        tokens.refresh_token = randomToken();
        await cx.query(
          "INSERT INTO oauth_refresh_tokens(token_hash,grant_id) VALUES($1,$2)",
          [hashToken(tokens.refresh_token), grant],
        );
      }
      return tokens;
    });
    res.json(result);
  });
  r.use(oauthErrors);
  return r;
}
