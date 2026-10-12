// AWS Lambda Node.js handler. Configure an Alexa Smart Home trigger restricted to YOUR skill ID.
// Do not add a public Function URL or an API Gateway trigger.
import { randomUUID } from "node:crypto";
export async function handler(event) {
  const url = new URL(process.env.OPENIOT_ALEXA_URL);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !process.env.OPENIOT_BRIDGE_SECRET
  )
    throw Error("Invalid bridge configuration");
  try {
    const r = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(6500),
      headers: {
        "Content-Type": "application/json",
        "X-OpenIoT-Bridge": process.env.OPENIOT_BRIDGE_SECRET,
      },
      body: JSON.stringify(event),
    });
    if (!r.ok) throw Error("Backend unavailable");
    return await r.json();
  } catch {
    const d = event?.directive;
    return {
      event: {
        header: {
          namespace: "Alexa",
          name: "ErrorResponse",
          messageId: randomUUID(),
          payloadVersion: "3",
          ...(d?.header?.correlationToken
            ? { correlationToken: d.header.correlationToken }
            : {}),
        },
        ...(d?.endpoint
          ? { endpoint: { endpointId: d.endpoint.endpointId } }
          : {}),
        payload: {
          type: "INTERNAL_ERROR",
          message: "Open IoT could not be reached.",
        },
      },
    };
  }
}
