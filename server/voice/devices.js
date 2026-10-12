import { randomUUID, createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { enqueueCommand } from "../pins.js";
import { events } from "../events.js";
export const voiceError = (code) =>
  Object.assign(new Error(code), { voiceCode: code });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function listDevices(db, userId, id) {
  if (id !== undefined && !uuid.test(id)) return [];
  const { rows } = await db.query(
    `SELECT d.id,d.name,d.last_seen_at,d.disabled_at,v.power_pin,v.brightness_pin,
    p.value AS power,p.reported_at AS power_at,b.value AS brightness,b.reported_at AS brightness_at
    FROM voice_devices v JOIN devices d ON d.id=v.device_id
    JOIN device_pins p ON p.device_id=d.id AND p.pin=v.power_pin
    LEFT JOIN device_pins b ON b.device_id=d.id AND b.pin=v.brightness_pin
    WHERE d.user_id=$1 AND ($2::uuid IS NULL OR d.id=$2) AND d.token_version=v.token_version
    AND p.direction='output' AND p.data_type='boolean'
    AND (v.brightness_pin IS NULL OR (b.direction='output' AND b.data_type='number' AND b.min_value=0 AND b.max_value=100))
    ORDER BY d.id`,
    [userId, id ?? null],
  );
  return rows;
}
export function online(d) {
  return (
    !d.disabled_at &&
    d.last_seen_at &&
    Date.now() - new Date(d.last_seen_at).getTime() < 30000
  );
}
export function known(d) {
  return (
    typeof d.power === "boolean" &&
    (!d.brightness_pin ||
      (typeof d.brightness === "number" &&
        d.brightness >= 0 &&
        d.brightness <= 100))
  );
}
export function googleState(d) {
  return {
    online: Boolean(online(d)),
    ...(typeof d.power === "boolean" ? { on: d.power } : {}),
    ...(d.brightness_pin && typeof d.brightness === "number"
      ? { brightness: d.brightness }
      : {}),
  };
}
export async function readDevice(db, userId, id) {
  const [d] = await listDevices(db, userId, id);
  if (!d) throw voiceError("notFound");
  if (!online(d)) throw voiceError("offline");
  return d;
}
export function createVoiceService({ db, tx, waitMs = 3500 }) {
  return {
    async execute(
      grant,
      requestId,
      id,
      changes,
      deadline = Date.now() + waitMs,
    ) {
      if (!uuid.test(id)) throw voiceError("notFound");
      const key = requestId + ":" + id;
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(changes))
        .digest("hex");
      let ids;
      try {
        ids = await tx(async (cx) => {
          // Serialize retries, recheck revocation, then lock the device using the same order as the core.
          const {
            rows: [g],
          } = await cx.query(
            "SELECT * FROM oauth_grants WHERE id=$1 AND revoked_at IS NULL FOR UPDATE",
            [grant.id],
          );
          if (!g) throw voiceError("auth");
          const {
            rows: [client],
          } = await cx.query("SELECT enabled FROM oauth_clients WHERE id=$1", [
            g.client_id,
          ]);
          if (!client?.enabled) throw voiceError("auth");
          await cx.query(
            "SELECT id FROM devices WHERE id=$1 AND user_id=$2 FOR UPDATE",
            [id, grant.user_id],
          );
          const d = await readDevice(cx, grant.user_id, id);
          const {
            rows: [old],
          } = await cx.query(
            "SELECT * FROM voice_requests WHERE grant_id=$1 AND request_key=$2",
            [g.id, key],
          );
          if (old) {
            if (old.fingerprint !== fingerprint) throw voiceError("invalid");
            return old.command_ids;
          }
          const commands = [];
          for (const [trait, value] of Object.entries(changes)) {
            const pin =
              trait === "on"
                ? d.power_pin
                : trait === "brightness"
                  ? d.brightness_pin
                  : null;
            if (!pin) throw voiceError("unsupported");
            if (
              trait === "on"
                ? typeof value !== "boolean"
                : !Number.isInteger(value) || value < 0 || value > 100
            )
              throw voiceError("invalid");
            const command = await enqueueCommand(cx, grant.user_id, id, {
              id: randomUUID(),
              pin,
              value,
            });
            // Short, bounded voice commands; do not deliver a queued command long after a timeout.
            await cx.query(
              "UPDATE device_commands SET expires_at=LEAST(expires_at,$1::timestamptz) WHERE id=$2",
              [new Date(deadline), command.id],
            );
            commands.push(command.id);
          }
          if (!commands.length) throw voiceError("invalid");
          await cx.query(
            "INSERT INTO voice_requests(grant_id,request_key,fingerprint,command_ids) VALUES($1,$2,$3,$4)",
            [g.id, key, fingerprint, commands],
          );
          return commands;
        });
      } catch (e) {
        if (e.voiceCode) throw e;
        if (e.status === 409) throw voiceError("busy");
        if (e.status === 400) throw voiceError("invalid");
        throw e;
      }
      events.emit("command", id);
      events.emit("state", id);
      do {
        const { rows } = await db.query(
          "SELECT status FROM device_commands WHERE id=ANY($1::uuid[])",
          [ids],
        );
        if (rows.length !== ids.length) throw voiceError("timeout"); // Never replay a pruned command.
        if (rows.every((c) => c.status === "acknowledged"))
          return readDevice(db, grant.user_id, id);
        if (
          rows.some((c) => c.status === "cancelled" || c.status === "expired")
        )
          throw voiceError("timeout");
        await delay(75);
      } while (Date.now() < deadline);
      // ACK and expiry serialize on device lock, just like normal device sync.
      const confirmed = await tx(async (cx) => {
        await cx.query("SELECT id FROM devices WHERE id=$1 FOR UPDATE", [id]);
        await cx.query(
          "UPDATE device_commands SET status='expired' WHERE id=ANY($1::uuid[]) AND status='pending'",
          [ids],
        );
        const { rows } = await cx.query(
          "SELECT status FROM device_commands WHERE id=ANY($1::uuid[])",
          [ids],
        );
        return (
          rows.length === ids.length &&
          rows.every((c) => c.status === "acknowledged")
        );
      });
      events.emit("state", id);
      if (confirmed) return readDevice(db, grant.user_id, id);
      throw voiceError("timeout");
    },
  };
}
