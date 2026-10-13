import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { nameSchema, emailSchema, passwordSchema, fail } from "../security.js";
import { managementOrigin, settingsSchema } from "./config.js";

export function createManagementApp({ token, db, controller, bcryptRounds = 12 }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ strictTransportSecurity: false }));
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    // Exact Host validation also blocks DNS rebinding on this loopback listener.
    if (req.get("host") !== new URL(managementOrigin).host) return res.sendStatus(403);
    next();
  });
  app.use(express.json({ limit: "8kb" }));
  app.use("/api", rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false }));
  app.use("/api", (req, res, next) => {
    const supplied = Buffer.from(req.get("authorization")?.replace(/^Bearer /, "") ?? "");
    const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.sendStatus(401);
    if (!["GET", "HEAD"].includes(req.method) && (req.get("origin") !== managementOrigin || !req.is("application/json"))) return res.sendStatus(403);
    next();
  });
  let busy = false;
  const exclusive = (work) => async (req, res) => {
    if (busy) throw fail(409, "Another server operation is running. Wait for it to finish.");
    busy = true;
    try { await work(req, res); } finally { busy = false; }
  };
  app.get("/api/status", async (req, res) => {
    const { rows } = await db.query("SELECT id FROM users LIMIT 1");
    res.json({ setupComplete: rows.length > 0, busy, ...await controller.status() });
  });
  app.post("/api/setup", exclusive(async (req, res) => {
    const data = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema }).strict().parse(req.body);
    const hash = await bcrypt.hash(data.password, bcryptRounds);
    const cx = await db.connect();
    try {
      await cx.query("BEGIN");
      await cx.query("SELECT pg_advisory_xact_lock(72146514)");
      if ((await cx.query("SELECT id FROM users LIMIT 1")).rows.length) throw fail(409, "Setup is already complete. Sign in to the dashboard.");
      const { rows: [user] } = await cx.query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id", [data.name, data.email, hash]);
      await cx.query("INSERT INTO audit_events(user_id,action) VALUES($1,'server.setup')", [user.id]);
      await cx.query("COMMIT");
    } catch (error) { await cx.query("ROLLBACK"); throw error; }
    finally { cx.release(); }
    res.status(201).json({ ok: true });
  }));
  app.put("/api/settings", exclusive(async (req, res) => {
    await controller.settings(settingsSchema.parse(req.body));
    res.json({ ok: true });
  }));
  app.post("/api/backups", exclusive(async (req, res) => res.status(201).json(await controller.backup())));
  app.post("/api/restore", exclusive(async (req, res) => {
    const { id, confirm } = z.object({ id: z.string().uuid(), confirm: z.literal("RESTORE") }).strict().parse(req.body);
    await controller.restore(id);
    res.json({ ok: true });
  }));
  app.post("/api/stop", exclusive(async (req, res) => {
    res.json({ ok: true });
    setImmediate(() => controller.stop());
  }));
  app.use("/api", (req, res) => res.sendStatus(404));
  app.use(express.static(fileURLToPath(new URL("./public/", import.meta.url))));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error instanceof z.ZodError ? 400 : error.status ?? 500;
    if (status >= 500) console.error("Server management operation failed:", error.code ?? error.name);
    res.status(status).json({ error: status >= 500 ? "Operation failed. Check the server logs." : error instanceof z.ZodError ? error.issues[0].message : error.message });
  });
  return app;
}
