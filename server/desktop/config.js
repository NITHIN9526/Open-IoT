import { randomBytes } from "node:crypto";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const managementOrigin = "http://127.0.0.1:3001";
export const settingsSchema = z.object({
  origin: z.string().refine((value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && url.origin === value;
    } catch { return false; }
  }, "Enter an exact http:// or https:// origin without a path."),
  lanAccess: z.boolean(),
  mqttEnabled: z.boolean(),
  registrationEnabled: z.boolean(),
  voiceEnabled: z.boolean(),
}).strict();
const secret = z.string().regex(/^[a-f0-9]{64}$/);
export const configSchema = z.object({
  version: z.literal(1),
  managementToken: secret,
  postgresPassword: secret,
  databasePassword: secret,
  encryptionKey: z.string().refine(v => Buffer.from(v, "base64").length === 32),
  settings: settingsSchema,
}).strict();
export function newConfig() {
  const token = () => randomBytes(32).toString("hex");
  return {
    version: 1, managementToken: token(), postgresPassword: token(),
    databasePassword: token(), encryptionKey: randomBytes(32).toString("base64"),
    settings: { origin: "http://localhost:3000", lanAccess: false, mqttEnabled: true,
      registrationEnabled: false, voiceEnabled: false },
  };
}
export async function loadConfig(dataDir) {
  return configSchema.parse(JSON.parse(await readFile(join(dataDir, "config.json"), "utf8")));
}
export async function saveConfig(dataDir, config) {
  configSchema.parse(config);
  const temporary = join(dataDir, "config.next.json");
  await writeFile(temporary, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  await rename(temporary, join(dataDir, "config.json"));
}
export async function prepare(dataDir) {
  await mkdir(dataDir, { recursive: true });
  for (const name of ["logs", "backups"]) await mkdir(join(dataDir, name), { recursive: true });
  try { return await loadConfig(dataDir); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const config = newConfig();
  // Exclusive creation prevents an upgrade or concurrent installer replacing keys.
  await writeFile(join(dataDir, "config.json"), JSON.stringify(config, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return config;
}
export function databaseUrl(config) {
  return `postgresql://openiot:${config.databasePassword}@127.0.0.1:5440/openiot`;
}
export function appEnvironment(config, base = process.env) {
  return { ...base, DATABASE_URL: databaseUrl(config), TOKEN_ENCRYPTION_KEY: config.encryptionKey,
    APP_ORIGIN: config.settings.origin, PORT: "3000", HOST: config.settings.lanAccess ? "0.0.0.0" : "127.0.0.1",
    NODE_ENV: config.settings.origin.startsWith("https://") ? "production" : "development",
    TRUST_PROXY: "", MQTT_ENABLED: String(config.settings.mqttEnabled),
    MQTT_HOST: config.settings.lanAccess ? "0.0.0.0" : "127.0.0.1", MQTT_PORT: "1883",
    VOICE_ENABLED: String(config.settings.voiceEnabled), REGISTRATION_ENABLED: String(config.settings.registrationEnabled),
  };
}
