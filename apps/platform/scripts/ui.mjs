#!/usr/bin/env node
/**
 * Browser test for the Platform app.
 */
import { chromium } from 'playwright';

const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3001';
const results = [];
let shot = 0;

function record(ac, name, pass, detail = '') {
  results.push({ ac, name, pass, detail });
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${ac.padEnd(14)} ${name}${detail ? `  — ${detail}` : ''}`);
}

async function goto(page, path) {
  const r = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForLoadState('load').catch(() => {});
  return r?.status();
}

async function waitForVisible(selector, timeout = 8000) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
}

/**
 * Delete Redis keys the throttle tests created. Same stdlib RESP approach as
 * apps/platform/src/lib/redis.ts — a suite must not leave a 15-minute login
 * block behind for the next run.
 */
async function redisDel(...keys) {
  const url = process.env.REDIS_URL;
  if (!url) return;
  const { createConnection } = await import('node:net');
  const u = new URL(url);
  const args = ['DEL', ...keys];
  const payload = `*${args.length}\r\n` + args.map((a) => `$${a.length}\r\n${a}\r\n`).join('');
  await new Promise((resolve) => {
    const sock = createConnection({ host: u.hostname, port: Number(u.port || 6379) }, () => sock.write(payload));
    sock.setTimeout(2000);
    sock.on('data', () => { sock.end(); resolve(); });
    sock.on('timeout', () => { sock.destroy(); resolve(); });
    sock.on('error', () => { sock.destroy(); resolve(); });
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Banned in this codebase: window.alert/confirm/prompt cannot be styled or
// trapped, and the suite would otherwise auto-dismiss them and never notice.
// Playwright dismisses an unhandled dialog silently, so this listener is what
// turns "a browser popup appeared" into a visible failure.
page.on('dialog', async (d) => {
  record('US-A05 AC1', `no native browser dialog (${d.type()}: ${d.message().slice(0, 40)})`, false,
    `type=${d.type()}`);
  await d.dismiss().catch(() => {});
});

async function shotPage(name) {
  await page.screenshot({ path: `shots/ui-${String(++shot).padStart(2, '0')}-${name}.png` });
}

// ── US-A02 AC1: login page ------------------------------------------------
{
  const s = await goto(page, '/login');
  record('US-A02 AC1', 'login page renders', s === 200, `status=${s}`);
  const hasForm = await page.locator('input[type="email"], input[name="email"]').count() > 0;
  record('US-A02 AC1', 'login form present', hasForm);
  await shotPage('login');
}

// ── US-A02 AC2: wrong password --------------------------------------------
{
  await waitForVisible('#email');
  await page.fill('#email', 'admin@seed.dev');
  await page.fill('#password', 'wrongpassword');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  const url = page.url();
  record('US-A02 AC2', 'wrong password refused', url.includes('/login'), `url=${url}`);
}

// ── US-A02 AC1: correct password ------------------------------------------
{
  await goto(page, '/login');
  await waitForVisible('#email');
  await page.fill('#email', 'admin@seed.dev');
  await page.fill('#password', 'seedadmin123');
  await page.click('button[type="submit"]');
  // Wait for the destination, not a fixed delay: the first hit on /apps also
  // pays for the dev server's compile, so a sleep races it and flakes.
  await page.waitForURL((u) => u.pathname.startsWith('/apps'), { timeout: 20000 }).catch(() => {});
  const url = page.url();
  record('US-A02 AC1', 'correct password logs in', url.includes('/apps'), `url=${url}`);
  await shotPage('apps');
}

// ── US-A02 AC3: 5 failures -> the form reports the wait, not "wrong password" ─
{
  await page.context().clearCookies();
  const victim = `ac3-ui-${Date.now()}@seed.dev`;
  await goto(page, '/login');
  await waitForVisible('#email');
  for (let i = 0; i < 6; i++) {
    await page.fill('#email', victim);
    await page.fill('#password', 'definitely-wrong');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(700);
  }
  const alert = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  // The user must be told the door is locked, and for how long — the generic
  // "Email atau password salah." would invite a 7th identical attempt.
  record('US-A02 AC3', 'the form shows a throttle message with a wait, not the generic refusal',
    !!alert && /percobaan masuk/i.test(alert) && /menit/i.test(alert),
    `alert=${alert}`);

  // Lift the block this test just created — otherwise the next run of the suite
  // starts with this email already locked.
  await redisDel(`platform:login:fail:${victim}`, `platform:login:block:${victim}`);
}

// ── US-A02 AC4: login lands back on the page the guard sent us from ────────
{
  await page.context().clearCookies();
  const s = await goto(page, '/apps/app-1');
  record('US-A02 AC4', 'deep link while signed out renders the login page',
    s === 200 && page.url().includes('/login'), `status=${s} url=${page.url()}`);
  record('US-A02 AC4', 'the login URL carries the requested page',
    decodeURIComponent(page.url()).includes('/apps/app-1'), `url=${page.url()}`);

  await waitForVisible('#email');
  await page.fill('#email', 'admin@seed.dev');
  await page.fill('#password', 'seedadmin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  // AC4: not /apps — the app the user asked for.
  record('US-A02 AC4', 'after login the browser is on the originally requested page',
    page.url().includes('/apps/app-1'), `url=${page.url()}`);
}

// ── US-A02 AC5: logout, then the back button must not show app data ────────
{
  await goto(page, '/apps');
  await waitForVisible('text=Daftar Aplikasi');
  record('US-A02 AC5', 'apps list is on screen before logout (control)',
    await page.getByText('Daftar Aplikasi').count() > 0);

  // Logout goes through the suite Modal, never window.confirm().
  await page.getByRole('button', { name: /Admin Seed/ }).click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  record('US-A02 AC5', 'logout opens a real dialog (role=dialog, no browser confirm)',
    await dialog.count() > 0);
  await dialog.getByRole('button', { name: /^Keluar$/ }).click();
  await page.waitForURL((u) => u.pathname === '/login', { timeout: 20000 }).catch(() => {});
  record('US-A02 AC5', 'logout lands on the login page',
    page.url().includes('/login'), `url=${page.url()}`);

  // The actual AC: press Back and look for app data.
  await page.goBack().catch(() => {});
  await page.waitForTimeout(2000);
  const backUrl = page.url();
  // Assert the data is absent, not that the URL happens to be /login — the AC
  // is about what the user sees, so `leaked === 0` is the assertion and the
  // URL is reported only as context.
  const leaked = await page.getByText('Daftar Aplikasi').count();
  record('US-A02 AC5', 'after Back the app list is not on screen',
    leaked === 0, `url=${backUrl} appListVisible=${leaked}`);

  // And a hard re-request of the page must be refused, which is what the
  // no-store header buys us (bfcache cannot serve it).
  const r = await goto(page, '/apps');
  record('US-A02 AC5', 're-requesting /apps after logout goes to /login',
    r === 200 && page.url().includes('/login'), `status=${r} url=${page.url()}`);

  // Re-establish a session: this block deliberately ended one, and the checks
  // below (US-A06) need a signed-in browser.
  await goto(page, '/login');
  await waitForVisible('#email');
  await page.fill('#email', 'admin@seed.dev');
  await page.fill('#password', 'seedadmin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

// ── US-A06 AC1: apps page -------------------------------------------------
{
  const rows = await page.locator('table tbody tr, [class*="app"]').count();
  const hasAppText = await page.getByText(/Test App|Welcome App|CRM Starter/).count() > 0;
  record('US-A06 AC1', 'apps list populated', rows >= 2 || hasAppText, `rows=${rows} hasAppText=${hasAppText}`);
}

// ── US-A05 AC1/AC2: create an app from the apps list -----------------------
// AC1 — "Kalau Adit mengisi nama aplikasi, saat disimpan, aplikasi dibuat dalam
//        keadaan draft (belum dipublikasikan) dan dia masuk ke editor."
// AC2 — "Kalau nama kosong, maka ditolak dengan pesan di field itu."
// Both are browser-level claims (the *editor* the user lands in, the message
// *in the field*), so they are driven here; the API half lives in e2e.mjs.
let usA05AppId = null;
{
  // Any browser dialog at all is a card failure, and the listener is attached
  // before the first click so it also covers a dialog opened by the create call.
  const nativeDialogs = [];
  page.on('dialog', async (d) => {
    nativeDialogs.push(`${d.type()}: ${d.message()}`);
    await d.dismiss().catch(() => {});
  });

  const s = await goto(page, '/apps');
  record('US-A05 AC1', 'the apps list renders for the signed-in admin', s === 200, `status=${s}`);
  await waitForVisible('button:has-text("Aplikasi baru")');

  await page.getByRole('button', { name: 'Aplikasi baru' }).click();
  const dialog = page.locator('[role="dialog"]').first();
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  record('US-A05 AC1', '"Aplikasi baru" opens a real dialog, not a browser prompt',
    (await dialog.getAttribute('aria-modal')) === 'true',
    `role=dialog aria-modal=${await dialog.getAttribute('aria-modal')}`);

  // The dialog must be labelled by its own heading and carry a visible dismiss
  // control — a browser prompt() has neither.
  const labelledBy = await dialog.getAttribute('aria-labelledby');
  record('US-A05 AC1', 'the dialog is labelled by its own title',
    !!labelledBy && (await page.locator(`#${labelledBy}`).innerText()).trim() === 'Buat aplikasi baru',
    `aria-labelledby=${labelledBy}`);
  record('US-A05 AC1', 'the dialog has a visible close control',
    await dialog.getByRole('button', { name: 'Tutup' }).count() === 1);

  // AC2 — the message belongs to the field, not to a floating toast.
  const before = (await (await page.request.get(`${BASE}/api/apps`)).json()).apps.length;
  await dialog.getByRole('button', { name: 'Buat aplikasi' }).click();
  const fieldError = await page.locator('#app-name-error').textContent().catch(() => null);
  record('US-A05 AC2', 'empty name shows the message on the name field',
    !!fieldError && fieldError.trim().length > 0, `fieldError=${JSON.stringify(fieldError?.trim())}`);
  record('US-A05 AC2', 'the dialog stays open and the page does not navigate',
    page.url().endsWith('/apps') && await dialog.isVisible(), `url=${page.url()}`);
  record('US-A05 AC2', 'the field is marked invalid for assistive tech',
    (await page.locator('#app-name').getAttribute('aria-invalid')) === 'true');
  const after = (await (await page.request.get(`${BASE}/api/apps`)).json()).apps.length;
  record('US-A05 AC2', 'the refused submit created no app row',
    after === before, `before=${before} after=${after}`);

  // Typing clears it, so the user is not left staring at a stale error.
  await page.fill('#app-name', 'Aplikasi Modal UI');
  record('US-A05 AC2', 'typing clears the field error',
    await page.locator('#app-name-error').count() === 0);

  // AC1 — saving lands the user in the editor of the new draft.
  await page.getByRole('button', { name: 'Buat aplikasi' }).click();
  await page.waitForURL(/\/apps\/[0-9a-f]{16}$/, { timeout: 20000 }).catch(() => {});
  const url = page.url();
  usA05AppId = url.match(/\/apps\/([0-9a-f]{16})$/)?.[1] ?? null;
  record('US-A05 AC1', 'saving the name lands the user in the app editor',
    !!usA05AppId, `url=${url}`);
  record('US-A05 AC1', 'the editor shows the app that was just created',
    (await page.getByText('Aplikasi Modal UI').count()) > 0);
  record('US-A05 AC1', 'the editor badge says Draft (not Terbit)',
    (await page.locator('header').getByText('Draft', { exact: true }).count()) === 1,
    'badge="Draft"');
  record('US-A05 AC1', 'the created app is a draft in the API too',
    (await (await page.request.get(`${BASE}/api/apps`)).json())
      .apps.find((a) => a.id === usA05AppId)?.is_published === false);
  record('US-A05 AC1', 'no browser dialog was ever opened',
    nativeDialogs.length === 0, `dialogs=${nativeDialogs.join(' | ') || 'none'}`);

  // The Modal contract the standard demands, exercised on a second open so the
  // create path above stays untouched.
  await goto(page, '/apps');
  const trigger = page.getByRole('button', { name: 'Aplikasi baru' });
  await trigger.click();
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  record('US-A05 AC1', 'focus moves into the dialog on open',
    await page.evaluate(() => document.activeElement?.id) === 'app-name');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
  record('US-A05 AC1', 'Escape closes the dialog',
    await page.locator('[role="dialog"]').count() === 0);
  record('US-A05 AC1', 'focus returns to the trigger on close',
    await page.evaluate(() => document.activeElement?.textContent?.trim()) === 'Aplikasi baru');

  await trigger.click();
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  await page.mouse.click(20, 500); // backdrop, well outside the panel
  await dialog.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
  record('US-A05 AC1', 'backdrop click closes the dialog',
    await page.locator('[role="dialog"]').count() === 0);
}

// ── teardown: the browser checks must not leave a fixture behind -----------
if (usA05AppId) {
  const del = await page.request.delete(`${BASE}/api/apps/${usA05AppId}`);
  record('US-A05 AC1', 'fixture app deleted after the browser checks',
    del.status() === 200, `status=${del.status()}`);
  const left = (await (await page.request.get(`${BASE}/api/apps`)).json()).apps
    .filter((a) => a.name === 'Aplikasi Modal UI').length;
  record('US-A05 AC1', 'no fixture app is left in the seed workspace',
    left === 0, `leftover=${left}`);

  // The app row cascades, but its activity_logs entry does not — the log is a
  // product feature (US-A07 AC5 records deletions), so the fixture has to remove
  // its own row or every run leaves one more behind.
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.PLATFORM_DATABASE_URL });
  const purged = await pool.query(
    "DELETE FROM activity_logs WHERE entity_type = 'app' AND entity_id = $1",
    [usA05AppId],
  );
  await pool.end();
  record('US-A05 AC1', 'the fixture activity_log row is removed too',
    purged.rowCount >= 1, `deleted_logs=${purged.rowCount}`);
}

// ── US-A29 AC1: health ----------------------------------------------------
{
  const s = await goto(page, '/health');
  record('US-A29 AC1', '/health renders', s === 200, `status=${s}`);
}

// ── guard: anon (US-A02 AC4 / US-A04 AC5) ---------------------------------
{
  await page.context().clearCookies();
  const s = await goto(page, '/apps');
  const url = page.url();
  record('US-A02 AC4', 'anon -> login', url.includes('/login'), `url=${url}`);
}

await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
