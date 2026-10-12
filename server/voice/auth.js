import { hashToken, tokenPattern } from "../security.js";
export function oauthError(error, status = 400) {
  return Object.assign(new Error(error), { oauthError: error, status });
}
export async function accessGrant(db, token, provider) {
  if (!tokenPattern.test(token ?? "")) throw oauthError("invalid_token", 401);
  const {
    rows: [g],
  } = await db.query(
    `SELECT g.* FROM oauth_access_tokens t
    JOIN oauth_grants g ON g.id=t.grant_id JOIN oauth_clients c ON c.id=g.client_id
    WHERE t.token_hash=$1 AND t.expires_at>now() AND g.revoked_at IS NULL
      AND c.enabled AND c.provider=$2`,
    [hashToken(token), provider],
  );
  if (!g) throw oauthError("invalid_token", 401);
  return g;
}
export function bearer(req) {
  const h = req.get("Authorization") ?? "";
  return /^Bearer [A-Za-z0-9_-]{43}$/i.test(h) ? h.slice(7) : "";
}
export function oauthErrors(err, req, res, next) {
  if (!err.oauthError) return next(err);
  res.set("Cache-Control", "no-store");
  if (err.status === 401) res.set("WWW-Authenticate", "Bearer");
  res.status(err.status).json({ error: err.oauthError });
}
