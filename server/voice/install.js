import { z } from "zod";
import { fail } from "../security.js";
import { oauthRouter } from "../routes/oauth.js";
import { googleSmartHomeRouter } from "../routes/googleSmartHome.js";
import { alexaSmartHomeRouter } from "../routes/alexaSmartHome.js";
import { createVoiceService } from "./devices.js";
export function installVoice(
  app,
  { db, tx, origin, limit, authenticate, bridgeSecret },
) {
  const service = createVoiceService({ db, tx });
  app.use("/oauth", oauthRouter({ db, tx, origin, limit }));
  app.use("/voice", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/voice/google", googleSmartHomeRouter({ db, service, limit }));
  if (bridgeSecret)
    app.use(
      "/voice/alexa",
      alexaSmartHomeRouter({ db, service, limit, bridgeSecret }),
    );
  app.get("/api/voice/devices", authenticate, async (req, res) => {
    const { rows } = await db.query(
      `SELECT v.* FROM voice_devices v JOIN devices d ON d.id=v.device_id WHERE d.user_id=$1`,
      [req.user.id],
    );
    res.json({ devices: rows });
  });
  const pin = z.string().regex(/^V([0-9]|[12][0-9]|3[01])$/);
  app.put(
    "/api/voice/devices/:id",
    authenticate,
    limit(30),
    async (req, res) => {
      const id = z.uuid().parse(req.params.id),
        b = z
          .object({
            powerPin: pin,
            brightnessPin: pin.nullable().default(null),
          })
          .strict()
          .parse(req.body);
      await tx(async (cx) => {
        const {
          rows: [d],
        } = await cx.query(
          "SELECT * FROM devices WHERE id=$1 AND user_id=$2 FOR UPDATE",
          [id, req.user.id],
        );
        if (!d) throw fail(404, "Device not found.");
        const { rows: pins } = await cx.query(
          "SELECT * FROM device_pins WHERE device_id=$1",
          [id],
        );
        const p = pins.find((x) => x.pin === b.powerPin),
          bright = pins.find((x) => x.pin === b.brightnessPin);
        if (p?.direction !== "output" || p.data_type !== "boolean")
          throw fail(400, "Power must be a boolean output.");
        if (
          b.brightnessPin &&
          (bright?.direction !== "output" ||
            bright.data_type !== "number" ||
            bright.min_value !== 0 ||
            bright.max_value !== 100)
        )
          throw fail(
            400,
            "Brightness must be a numeric output with range 0–100.",
          );
        await cx.query(
          `INSERT INTO voice_devices(device_id,power_pin,brightness_pin,token_version) VALUES($1,$2,$3,$4)
        ON CONFLICT(device_id) DO UPDATE SET power_pin=EXCLUDED.power_pin,brightness_pin=EXCLUDED.brightness_pin,token_version=EXCLUDED.token_version`,
          [id, b.powerPin, b.brightnessPin, d.token_version],
        );
      });
      res.json({ ok: true });
    },
  );
  app.delete("/api/voice/devices/:id", authenticate, async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    await tx(async (cx) => {
      const {
        rows: [d],
      } = await cx.query(
        "SELECT id FROM devices WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [id, req.user.id],
      );
      if (!d) throw fail(404, "Device not found.");
      await cx.query("DELETE FROM voice_devices WHERE device_id=$1", [id]);
      await cx.query(
        `UPDATE device_commands SET status='cancelled' WHERE device_id=$1 AND status='pending'
        AND id IN (SELECT unnest(command_ids) FROM voice_requests)`,
        [id],
      );
    });
    res.json({ ok: true });
  });
  app.get("/api/voice/grants", authenticate, async (req, res) => {
    const { rows } = await db.query(
      `SELECT g.id,c.name,c.provider,g.created_at,g.revoked_at FROM oauth_grants g
      JOIN oauth_clients c ON c.id=g.client_id WHERE g.user_id=$1 ORDER BY g.created_at DESC`,
      [req.user.id],
    );
    res.json({ grants: rows });
  });
  app.delete("/api/voice/grants/:id", authenticate, async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    await db.query(
      "UPDATE oauth_grants SET revoked_at=now() WHERE id=$1 AND user_id=$2",
      [id, req.user.id],
    );
    res.json({ ok: true });
  });
}
