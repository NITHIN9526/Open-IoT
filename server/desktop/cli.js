import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadConfig, prepare, managementOrigin } from "./config.js";
import { startInstalledServer } from "./runtime.js";
const [command, folder] = process.argv.slice(2);
if (!folder || !["prepare", "run", "stop"].includes(command)) throw Error("Usage: cli.js prepare|run|stop <data-directory>");
const dataDir = resolve(folder);
if (command === "prepare") await prepare(dataDir);
if (command === "run") await startInstalledServer({ root: fileURLToPath(new URL("../../", import.meta.url)), dataDir });
if (command === "stop") {
  const config = await loadConfig(dataDir);
  const response = await fetch(managementOrigin + "/api/stop", { method: "POST", headers: {
    Authorization: `Bearer ${config.managementToken}`, Origin: managementOrigin, "Content-Type": "application/json",
  }, body: "{}", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error("Server refused stop request.");
}
