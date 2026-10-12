import { Router } from "express";
import { accessGrant, bearer, oauthErrors } from "../voice/auth.js";
import {
  listDevices,
  readDevice,
  known,
  googleState,
  voiceError,
} from "../voice/devices.js";
const errors = {
  notFound: "deviceNotFound",
  offline: "deviceOffline",
  busy: "deviceBusy",
  timeout: "deviceOffline",
  invalid: "valueOutOfRange",
  unsupported: "functionNotSupported",
  auth: "authFailure",
};
export function googleSmartHomeRouter({ db, service, limit }) {
  const r = Router();
  r.post("/", limit(120), async (req, res) => {
    const g = await accessGrant(db, bearer(req), "google"),
      b = req.body;
    if (
      typeof b?.requestId !== "string" ||
      !b.requestId.length ||
      b.requestId.length > 200 ||
      !Array.isArray(b.inputs) ||
      b.inputs.length !== 1
    )
      return res.status(400).json({ error: "Invalid intent envelope" });
    const input = b.inputs[0];
    let payload;
    if (input.intent === "action.devices.SYNC") {
      payload = {
        agentUserId: g.user_id,
        devices: (await listDevices(db, g.user_id)).map((d) => ({
          id: d.id,
          type: d.brightness_pin
            ? "action.devices.types.LIGHT"
            : "action.devices.types.SWITCH",
          traits: [
            "action.devices.traits.OnOff",
            ...(d.brightness_pin ? ["action.devices.traits.Brightness"] : []),
          ],
          name: { name: d.name },
          willReportState: false,
          attributes: {},
          deviceInfo: {
            manufacturer: "Open IoT",
            model: "Virtual pins",
            swVersion: "5.1-voice",
          },
        })),
      };
    } else if (input.intent === "action.devices.QUERY") {
      const devices = input.payload?.devices;
      if (
        !Array.isArray(devices) ||
        devices.length > 100 ||
        devices.some((d) => typeof d?.id !== "string")
      )
        return res.sendStatus(400);
      payload = { devices: {} };
      for (const item of devices) {
        try {
          const d = await readDevice(db, g.user_id, item.id);
          if (!known(d)) throw voiceError("offline");
          Object.defineProperty(payload.devices, item.id, {
            value: { ...googleState(d), status: "SUCCESS" },
            enumerable: true,
          });
        } catch (e) {
          if (!e.voiceCode) throw e;
          Object.defineProperty(payload.devices, item.id, {
            value: {
              online: false,
              status: "ERROR",
              errorCode: errors[e.voiceCode],
            },
            enumerable: true,
          });
        }
      }
    } else if (input.intent === "action.devices.EXECUTE") {
      const groups = input.payload?.commands;
      if (!Array.isArray(groups) || !groups.length || groups.length > 10)
        return res.sendStatus(400);
      const work = [];
      const seen = new Set();
      for (const group of groups) {
        if (
          !Array.isArray(group.devices) ||
          !group.devices.length ||
          !Array.isArray(group.execution) ||
          !group.execution.length ||
          group.execution.length > 2
        )
          return res.sendStatus(400);
        const changes = {};
        let error;
        for (const e of group.execution) {
          if (
            e.command === "action.devices.commands.OnOff" &&
            typeof e.params?.on === "boolean"
          )
            changes.on = e.params.on;
          else if (
            e.command === "action.devices.commands.BrightnessAbsolute" &&
            Number.isInteger(e.params?.brightness) &&
            e.params.brightness >= 0 &&
            e.params.brightness <= 100
          )
            changes.brightness = e.params.brightness;
          else error = "functionNotSupported";
        }
        for (const d of group.devices) {
          if (typeof d?.id !== "string" || seen.has(d.id))
            return res.sendStatus(400);
          seen.add(d.id);
          work.push({ id: d.id, changes, error });
        }
      }
      if (work.length > 10)
        return res
          .status(400)
          .json({ error: "At most 10 devices per execute" });
      const deadline = Date.now() + 3500;
      payload = {
        commands: await Promise.all(
          work.map(async (w) => {
            if (w.error)
              return { ids: [w.id], status: "ERROR", errorCode: w.error };
            try {
              const d = await service.execute(
                g,
                b.requestId,
                w.id,
                w.changes,
                deadline,
              );
              return { ids: [w.id], status: "SUCCESS", states: googleState(d) };
            } catch (e) {
              if (!e.voiceCode) throw e;
              return {
                ids: [w.id],
                status: "ERROR",
                errorCode: errors[e.voiceCode] ?? "hardError",
              };
            }
          }),
        ),
      };
    } else if (input.intent === "action.devices.DISCONNECT") {
      await db.query("UPDATE oauth_grants SET revoked_at=now() WHERE id=$1", [
        g.id,
      ]);
      return res.json({});
    } else return res.status(400).json({ error: "Unsupported intent" });
    res.json({ requestId: b.requestId, payload });
  });
  r.use(oauthErrors);
  return r;
}
