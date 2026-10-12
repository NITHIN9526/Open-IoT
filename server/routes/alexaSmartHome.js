import { Router } from "express";
import { randomUUID } from "node:crypto";
import { equal } from "../security.js";
import { accessGrant } from "../voice/auth.js";
import {
  listDevices,
  readDevice,
  known,
  voiceError,
} from "../voice/devices.js";
export function alexaResponse(
  d,
  name,
  payload = {},
  properties,
  namespace = "Alexa",
) {
  return {
    ...(properties ? { context: { properties } } : {}),
    event: {
      header: {
        namespace,
        name,
        messageId: randomUUID(),
        payloadVersion: "3",
        ...(d.header?.correlationToken
          ? { correlationToken: d.header.correlationToken }
          : {}),
      },
      ...(d.endpoint
        ? { endpoint: { endpointId: d.endpoint.endpointId } }
        : {}),
      payload,
    },
  };
}
function properties(d) {
  const prop = (namespace, name, value, time) => ({
    namespace,
    name,
    value,
    timeOfSample: new Date(time).toISOString(),
    uncertaintyInMilliseconds: 0,
  });
  return [
    prop(
      "Alexa.PowerController",
      "powerState",
      d.power ? "ON" : "OFF",
      d.power_at,
    ),
    prop(
      "Alexa.EndpointHealth",
      "connectivity",
      { value: "OK" },
      d.last_seen_at,
    ),
  ];
}
const cap = (name, property) => ({
  type: "AlexaInterface",
  interface: name,
  version: name === "Alexa.EndpointHealth" ? "3.2" : "3",
  ...(property
    ? {
        properties: {
          supported: [{ name: property }],
          proactivelyReported: false,
          retrievable: true,
        },
      }
    : {}),
});
export function alexaSmartHomeRouter({ db, service, limit, bridgeSecret }) {
  if (!bridgeSecret || bridgeSecret.length < 43)
    throw Error("ALEXA_BRIDGE_SECRET must have at least 43 random characters");
  const r = Router();
  r.post("/", limit(120), async (req, res) => {
    if (!equal(req.get("X-OpenIoT-Bridge"), bridgeSecret))
      return res.sendStatus(401);
    const d = req.body?.directive,
      h = d?.header;
    if (
      !h ||
      h.payloadVersion !== "3" ||
      typeof h.messageId !== "string" ||
      !h.messageId.length ||
      h.messageId.length > 200
    )
      return res.sendStatus(400);
    try {
      const scope =
        h.namespace === "Alexa.Discovery"
          ? d.payload?.scope
          : d.endpoint?.scope;
      const g = await accessGrant(
        db,
        scope?.type === "BearerToken" ? scope.token : "",
        "alexa",
      );
      if (h.namespace === "Alexa.Discovery" && h.name === "Discover") {
        const endpoints = (await listDevices(db, g.user_id)).map((x) => ({
          endpointId: x.id,
          manufacturerName: "Open IoT",
          friendlyName: x.name,
          description: "Open IoT virtual pin device",
          displayCategories: [x.brightness_pin ? "LIGHT" : "SWITCH"],
          cookie: {},
          capabilities: [
            cap("Alexa"),
            cap("Alexa.PowerController", "powerState"),
            cap("Alexa.EndpointHealth", "connectivity"),
          ],
        }));
        return res.json(
          alexaResponse(
            d,
            "Discover.Response",
            { endpoints },
            undefined,
            "Alexa.Discovery",
          ),
        );
      }
      const id = d.endpoint?.endpointId;
      if (typeof id !== "string") throw voiceError("notFound");
      let device;
      if (h.namespace === "Alexa" && h.name === "ReportState")
        device = await readDevice(db, g.user_id, id);
      else {
        let changes;
        if (
          h.namespace === "Alexa.PowerController" &&
          ["TurnOn", "TurnOff"].includes(h.name)
        )
          changes = { on: h.name === "TurnOn" };
        else throw voiceError("unsupported");
        device = await service.execute(g, h.messageId, id, changes);
      }
      if (typeof device.power !== "boolean") throw voiceError("offline");
      res.json(
        alexaResponse(
          d,
          h.name === "ReportState" ? "StateReport" : "Response",
          {},
          properties(device),
        ),
      );
    } catch (e) {
      const type = e.oauthError
        ? "INVALID_AUTHORIZATION_CREDENTIAL"
        : {
            notFound: "NO_SUCH_ENDPOINT",
            offline: "ENDPOINT_UNREACHABLE",
            busy: "ENDPOINT_BUSY",
            timeout: "ENDPOINT_UNREACHABLE",
            invalid: "INVALID_VALUE",
            unsupported: "INVALID_DIRECTIVE",
            auth: "INVALID_AUTHORIZATION_CREDENTIAL",
          }[e.voiceCode];
      if (!type) throw e;
      res.json(
        alexaResponse(d, "ErrorResponse", {
          type,
          message: "Unable to complete the requested operation.",
        }),
      );
    }
  });
  return r;
}
