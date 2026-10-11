import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createTestDb } from "./database.js";
import { attachLive } from "../server/live.js";
import { runSchedules } from "../server/features.js";
import { DateTime } from "luxon";
import { createApp } from "../server/app.js";
import { randomBytes } from "node:crypto";
const db = await createTestDb();
const app = await createApp({
  db,
  encryptionKey: randomBytes(32),
  origin: "http://127.0.0.1:4178",
  bcryptRounds: 4,
  disableLimits: true,
});
const server = app.listen(4178, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const stopLive = attachLive(server, { db, origin: "http://127.0.0.1:4178" });
await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.addInitScript(() => Object.defineProperty(globalThis.crypto,"randomUUID",{value:undefined,configurable:true}));
let simulator;
try {
  await page.goto("http://127.0.0.1:4178");
  await page.getByRole("heading", { name: /Your devices/ }).waitFor();
  await page.screenshot({
    path: "docs/screenshots/landing.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Get started", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Open IoT Demo");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("browser@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("safe-browser-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("heading", { name: "Your connected world." }).waitFor();
  await page.getByRole("button", { name: "Add your first device" }).click();
  await page
    .getByLabel("Device name", { exact: true })
    .fill("My laptop simulator");
  await page
    .getByRole("button", { name: "Create device", exact: true })
    .click();
  const token = await page
    .getByRole("textbox", { name: "Device auth token", exact: true })
    .inputValue();
  assert.equal(token.length, 43);
  await page.getByRole("button", { name: "Close dialog" }).click();

  const id=(await db.query('SELECT id FROM devices')).rows[0].id;
  for(const [path,title] of [['/dashboard','Devices'],['/dashboard/devices/'+id,'Device controls'],['/dashboard/builder','My dashboard'],['/dashboard/automations','Automations'],['/dashboard/groups','Rooms & groups'],['/dashboard/scenes','Scenes'],['/dashboard/rules','Sensor rules'],['/dashboard/account','My account']]) {
    await page.goto('http://127.0.0.1:4178'+path);
    await page.getByRole('button',{name:'How to use',exact:true}).click();
    await page.getByRole('heading',{name:title+' manual',exact:true}).waitFor();
    await expect(page.locator('dialog ol li')).not.toHaveCount(0);
    await page.locator('dialog summary').first().click();
    await expect(page.locator('dialog details').first()).toHaveAttribute('open','');
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    await expect(page.locator('dialog')).toHaveCount(0);
  }
  await page.goto('http://127.0.0.1:4178/docs?tab=rules');
  await page.getByRole('heading',{name:'Sensor rules',exact:true}).waitFor();
  await page.getByLabel('Search manuals').fill('cooldown');
  await expect(page.locator('.manual-reading article')).toHaveCount(1);
  await page.getByLabel('Search manuals').fill('zzznomatch');
  await page.getByText('No matching topics. Try “power”, “timezone” or “offline”.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Scenes',exact:true}).click();
  await page.getByRole('heading',{name:'Scenes',exact:true}).waitFor();
  await page.screenshot({path:'docs/screenshots/manual-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Sensor rules',exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'manual mobile overflow');
  await page.screenshot({path:'docs/screenshots/manual-mobile.png',fullPage:true});
  await page.goto('http://127.0.0.1:4178/dashboard/rules');
  await page.getByRole('button',{name:'How to use',exact:true}).click();
  await page.getByRole('heading',{name:'Sensor rules manual',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'help mobile overflow');
  await page.getByRole('link',{name:'Open full manual',exact:true}).click();
  await page.getByRole('heading',{name:'Sensor rules',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('Manual browser checks passed: contextual help on all 8 dashboard pages, full guide deep links, search/empty results, troubleshooting expansion, dialog close controls, desktop/mobile layouts, no page errors.');
} finally {
  await browser.close();stopLive();await new Promise(r=>server.close(r));await db.raw.close();
}
