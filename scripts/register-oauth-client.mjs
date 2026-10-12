import { Pool } from "pg";
import { randomToken, hashToken } from "../server/security.js";
const [provider, id, ...redirects] = process.argv.slice(2);
if (
  !["google", "alexa"].includes(provider) ||
  !/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "") ||
  !redirects.length
)
  throw Error(
    "Usage: node --env-file=.env scripts/register-oauth-client.mjs google|alexa CLIENT_ID EXACT_HTTPS_REDIRECT [OTHER_REDIRECT]",
  );
for (const value of redirects) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.hash || u.username || u.password)
    throw Error("Redirects require HTTPS, no credentials or fragments");
}
const db = new Pool({ connectionString: process.env.DATABASE_URL }),
  secret = randomToken();
try {
  await db.query(
    "INSERT INTO oauth_clients(id,provider,name,secret_hash,redirect_uris) VALUES($1,$2,$3,$4,$5)",
    [
      id,
      provider,
      provider === "google" ? "Google" : "Amazon Alexa",
      hashToken(secret),
      redirects,
    ],
  );
  console.log("Client ID:", id);
  console.log("Client secret (shown once; save privately):", secret);
} finally {
  await db.end();
}
