import { Pool } from "pg";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const table of [
    "oauth_interactions",
    "oauth_codes",
    "oauth_access_tokens",
    "oauth_refresh_tokens",
  ])
    await db.query(`DELETE FROM ${table} WHERE expires_at<now()`);
  // Removing a grant also removes deduplication tombstones. No valid token can use it afterward.
  await db.query(`DELETE FROM oauth_grants g WHERE
  (g.revoked_at<now()-interval '7 days' OR g.created_at<now()-interval '91 days')
  AND NOT EXISTS(SELECT 1 FROM oauth_access_tokens t WHERE t.grant_id=g.id)
  AND NOT EXISTS(SELECT 1 FROM oauth_refresh_tokens t WHERE t.grant_id=g.id)
  AND NOT EXISTS(SELECT 1 FROM oauth_codes t WHERE t.grant_id=g.id)`);
  console.log("Expired OAuth records removed.");
} finally {
  await db.end();
}
