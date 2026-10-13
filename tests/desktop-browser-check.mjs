import { chromium, expect } from '@playwright/test';
import { once } from 'node:events';
import { createTestDb } from './database.js';
import { newConfig } from '../server/desktop/config.js';
import { createManagementApp } from '../server/desktop/management.js';
const db = await createTestDb(), config = newConfig();
let settings = config.settings, backups = [], restores = 0;
const controller = {
  status: async () => ({ settings, running: true, backups, dataDir: 'C:\\ProgramData\\OpenIoT' }),
  settings: async value => { settings = value; },
  backup: async () => { const item = { id: 'ccf56c42-9d83-4a39-99a2-00cd2eb6d1ab', createdAt: new Date().toISOString() }; backups.push(item); return item; },
  restore: async () => { restores++; }, stop: () => {},
};
const server = createManagementApp({ token: config.managementToken, db, controller, bcryptRounds: 4 }).listen(3001, '127.0.0.1');
await once(server, 'listening');
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3001/#token=' + config.managementToken);
  await expect(page.getByRole('heading', { name: 'Create your first account' })).toBeVisible();
  await page.getByLabel('Your name').fill('Server Owner');
  await page.getByLabel('Email', { exact: true }).fill('owner@example.com');
  await page.getByLabel('Password', { exact: true }).fill('a-test-password-12345');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Your server', exact: true })).toBeVisible();
  await page.getByLabel('Allow devices on the local network').check();
  await page.getByRole('button', { name: 'Save and restart dashboard' }).click();
  await expect(page.getByRole('status')).toHaveText('Settings saved. Dashboard restarted.');
  if (!settings.lanAccess) throw Error('Settings were not saved');
  await page.getByRole('button', { name: 'Create backup' }).click();
  await expect(page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept('RESTORE'));
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Backup restored');
  if (restores !== 1) throw Error('Restore was not requested');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your server', exact: true })).toBeVisible();
  if (page.url().includes('token=')) throw Error('Management token stayed in browser address');
  const stranger = await browser.newPage();
  await stranger.goto('http://127.0.0.1:3001/');
  await expect(stranger.getByRole('status')).toContainText('Start Menu');
  console.log('Desktop setup browser check passed: account, settings, backup, restore, reload and authorization.');
} finally {
  await browser?.close();
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await db.raw.close();
}
