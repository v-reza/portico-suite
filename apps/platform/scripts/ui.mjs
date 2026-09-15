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

/**
 * Direct DB access, for fixtures the HTTP API cannot remove (a whole workspace).
 * Mirrors the helper in e2e.mjs.
 */
async function pgPool() {
  const { Pool } = await import('pg');
  return new Pool({ connectionString: process.env.PLATFORM_DATABASE_URL });
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

// ── US-A06 AC1: the list renders as cards carrying the five fields ----------
// Driven in the browser because "tampil sebagai kartu berisi …" is a claim about
// what is on screen. Each field is located inside the card, so a card that drops
// the slug or the timestamp fails even though the list still "renders".
{
  const s = await goto(page, '/apps');
  record('US-A06 AC1', 'the apps list page renders', s === 200, `status=${s}`);

  const grid = page.locator('[data-state="ready"]');
  await grid.waitFor({ state: 'visible', timeout: 10000 });
  const cards = grid.locator('[data-app-card]');
  const count = await cards.count();
  record('US-A06 AC1', 'the apps are rendered as cards', count >= 2, `cards=${count}`);

  const first = cards.first();
  const name = (await first.locator('h3').first().innerText()).trim();
  record('US-A06 AC1', 'the card shows the app name', name.length > 0, `name=${name}`);

  // The slug is rendered with the reference's literal `app/` prefix.
  const slugText = (await first.locator('.font-mono').first().innerText()).trim();
  record('US-A06 AC1', "the card shows the slug with the reference's app/ prefix",
    /^app\/[a-z0-9-]+$/.test(slugText), `slug=${slugText}`);

  const desc = (await first.locator('p').first().innerText()).trim();
  record('US-A06 AC1', 'the card shows a short description',
    desc.length > 0 && desc.split(/\s+/).length <= 40, `desc=${desc.slice(0, 60)}`);

  const badge = (await first.locator('span').filter({ hasText: /^(Terbit|Draft)$/ }).first().innerText()).trim();
  record('US-A06 AC1', 'the card shows a status badge (Terbit / Draft)',
    badge === 'Terbit' || badge === 'Draft', `badge=${badge}`);

  // The timestamp uses the reference's literal `diubah ` prefix and a relative
  // age — "waktu terakhir diubah".
  const stamp = (await first.locator('span').filter({ hasText: /^diubah / }).first().innerText()).trim();
  record('US-A06 AC1', "the card shows the last-modified time with the reference's diubah prefix",
    /^diubah \d+[mh] lalu$/.test(stamp), `stamp=${stamp}`);

  // All five fields on the SAME card, not spread across the grid.
  record('US-A06 AC1', 'one card carries all five fields together',
    name.length > 0 && /^app\//.test(slugText) && desc.length > 0
      && (badge === 'Terbit' || badge === 'Draft') && /^diubah /.test(stamp),
    `name=${name} slug=${slugText} badge=${badge} stamp=${stamp}`);

  // "Kalau ada 4 aplikasi": top the workspace up to exactly 4 so the count is
  // known regardless of what a previous run left behind.
  const tag = Date.now();
  const made = [];
  const apiCount = async () =>
    ((await (await page.request.get(`${BASE}/api/apps`)).json())?.apps ?? []).length;
  const existing = await apiCount();
  for (let i = existing; i < 4; i++) {
    const r = await page.request.post(`${BASE}/api/apps`, { data: { name: `A06 Kartu ${tag} ${i}` } });
    const b = await r.json().catch(() => ({}));
    if (b?.app?.id) made.push(b.app.id);
  }
  const apiFour = await apiCount();
  await goto(page, '/apps');
  await grid.waitFor({ state: 'visible', timeout: 10000 });
  const four = await cards.count();
  // Both halves matter: the workspace really holds 4, and the screen draws one
  // card for each. A count that matched a stale page would pass on one alone.
  record('US-A06 AC1', 'with 4 apps in the workspace, 4 cards are rendered',
    apiFour === 4 && four === 4, `api=${apiFour} cards=${four}`);
  const badges = await grid.locator('span').filter({ hasText: /^(Terbit|Draft)$/ }).allInnerTexts();
  record('US-A06 AC1', 'both badge treatments render on real data',
    badges.map((b) => b.trim()).includes('Terbit') && badges.map((b) => b.trim()).includes('Draft'),
    `badges=${badges.map((b) => b.trim()).join(',')}`);

  for (const id of made) await page.request.delete(`${BASE}/api/apps/${id}`);
  // Deleting an app cascades to its pages/components but NOT to its audit rows
  // (`activity_logs.entity_id` has no FK), so the log is purged explicitly —
  // otherwise the workspace drifts away from the seed on every run.
  const pool = await pgPool();
  for (const id of made) {
    await pool.query("DELETE FROM activity_logs WHERE entity_type = 'app' AND entity_id = $1", [id]);
  }
  const leftover = ((await (await page.request.get(`${BASE}/api/apps`)).json())?.apps ?? [])
    .filter((a) => a.name.startsWith(`A06 Kartu ${tag}`)).length;
  const orphanLogs = Number((await pool.query(
    "SELECT count(*)::int n FROM activity_logs WHERE entity_id = ANY($1::text[])", [made],
  )).rows[0].n);
  await pool.end();
  record('US-A06 AC1', 'the card fixtures were removed', leftover === 0, `leftover=${leftover}`);
  record('US-A06 AC1', 'the fixture activity_log rows were removed too',
    orphanLogs === 0, `orphanLogs=${orphanLogs}`);
}

// ── US-A06 AC2: the empty state offers exactly two actions ------------------
// A brand-new workspace is the only honest way to see it: the seed workspace
// always has apps, and an empty state faked by filtering would not exercise the
// real zero-app branch.
{
  const tag = Date.now();
  const email = `a06-empty-${tag}@seed.dev`;
  const pw = 'emptysecret123';

  const reg = await page.request.post(`${BASE}/api/auth/register`, {
    data: { name: 'Empty A06', workspace_name: `Empty WS ${tag}`, email, password: pw, confirm: pw },
  });
  record('US-A06 AC2', 'an empty workspace exists to render the empty state',
    reg.status() === 201, `status=${reg.status()}`);

  await page.context().clearCookies();
  await goto(page, '/login');
  await waitForVisible('#email');
  await page.fill('#email', email);
  await page.fill('#password', pw);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await goto(page, '/apps');
  const empty = page.locator('[data-state="empty"]');
  await empty.waitFor({ state: 'visible', timeout: 10000 });
  record('US-A06 AC2', 'a workspace with no apps renders the empty state', await empty.count() === 1);
  const heading = (await empty.locator('h3').first().innerText()).trim();
  record('US-A06 AC2', 'the empty state is not a blank screen (it carries a heading)',
    heading.length > 0, `heading=${heading}`);

  // Exactly the two actions the AC names — a third button would be chrome the
  // design and the AC do not ask for.
  const labels = (await empty.getByRole('button').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  record('US-A06 AC2', 'the empty state offers exactly two actions',
    labels.length === 2, `labels=${labels.join(' | ')}`);
  record('US-A06 AC2', 'the two actions are "buat dari prompt" and "buat kosong"',
    labels.some((l) => /prompt/i.test(l)) && labels.some((l) => /kosong/i.test(l)),
    `labels=${labels.join(' | ')}`);

  // Any browser dialog at all is a card failure; the listener goes on first.
  const nativeDialogs = [];
  page.on('dialog', async (d) => {
    nativeDialogs.push(`${d.type()}: ${d.message()}`);
    await d.dismiss().catch(() => {});
  });

  await empty.getByRole('button', { name: /prompt/i }).click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  record('US-A06 AC2', '"buat dari prompt" opens a real dialog, not a browser prompt',
    (await dialog.getAttribute('aria-modal')) === 'true' && nativeDialogs.length === 0,
    `aria-modal=${await dialog.getAttribute('aria-modal')} nativeDialogs=${nativeDialogs.join('|') || 'none'}`);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});

  await empty.getByRole('button', { name: /kosong/i }).click();
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  const createTitle = (await dialog.locator('h3').first().innerText()).trim();
  record('US-A06 AC2', '"buat kosong" opens the manual create dialog',
    createTitle.length > 0 && nativeDialogs.length === 0,
    `title=${createTitle} nativeDialogs=${nativeDialogs.join('|') || 'none'}`);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});

  // Teardown: the workspace is empty, so only its log, user and org.
  await page.context().clearCookies();
  const pool = await pgPool();
  const u = await pool.query('SELECT id, org_id FROM users WHERE email = $1', [email]);
  if (u.rows[0]) {
    await pool.query('DELETE FROM activity_logs WHERE org_id = $1', [u.rows[0].org_id]);
    await pool.query('DELETE FROM users WHERE id = $1', [u.rows[0].id]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [u.rows[0].org_id]);
  }
  const gone = await pool.query('SELECT count(*)::int n FROM users WHERE email = $1', [email]);
  await pool.end();
  record('US-A06 AC2', 'the empty-state fixture workspace was removed',
    Number(gone.rows[0].n) === 0, `remaining=${gone.rows[0].n}`);
}

// ── US-A06 AC3: loading shows a skeleton, not an empty screen ---------------
// The window is opened artificially: the list resolves in milliseconds locally,
// so waiting to catch the real one would make the assertion a race. `route` holds
// the API response open, which is the state the AC describes.
{
  await page.context().clearCookies();
  await goto(page, '/login');
  await waitForVisible('#email');
  await page.fill('#email', 'admin@seed.dev');
  await page.fill('#password', 'seedadmin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  await page.route('**/api/apps', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await new Promise((r) => setTimeout(r, 1500));
    return route.continue();
  });
  await goto(page, '/apps');
  await page.waitForTimeout(400); // inside the held window

  const state = await page.locator('[data-state]').first().getAttribute('data-state').catch(() => null);
  const skeletons = await page.locator('.skeleton-pulse').count();
  record('US-A06 AC3', 'while the list is loading the page reports the loading state',
    state === 'loading', `data-state=${state}`);
  record('US-A06 AC3', 'the loading state renders skeleton blocks, not an empty screen',
    skeletons > 0, `skeletonBlocks=${skeletons}`);
  // "bukan layar kosong": no app card may be on screen yet.
  record('US-A06 AC3', 'no app card is rendered while loading',
    await page.locator('[data-state="loading"] [data-app-card]').count() === 0);

  // Unroute only after the held response has landed: removing the handler while
  // the request is still open would leave the skeleton up forever.
  await page.locator('[data-state="ready"]').waitFor({ state: 'visible', timeout: 10000 });
  const after = await page.locator('[data-state="ready"] [data-app-card]').count();
  record('US-A06 AC3', 'the skeleton gives way to the real list', after >= 2, `cards=${after}`);
  await page.unroute('**/api/apps');
}

// ── US-A06 AC4: a failed load shows an error + retry, and no half-built cards
// The failure is injected at the network layer so the client's real error branch
// runs; a mocked component would prove nothing about what the user sees.
{
  let failNext = true;
  await page.route('**/api/apps', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    if (!failNext) return route.continue();
    failNext = false;
    return route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }),
    });
  });

  await goto(page, '/apps');
  const errorState = page.locator('[data-state="error"]');
  await errorState.waitFor({ state: 'visible', timeout: 10000 });
  const alert = errorState.locator('[role="alert"]');
  const message = (await alert.innerText()).trim();
  record('US-A06 AC4', 'a failed load shows an error message', message.length > 0, `message=${message}`);
  const retry = alert.getByRole('button', { name: /coba lagi/i });
  record('US-A06 AC4', 'the error state offers a retry button', await retry.count() === 1);
  // "kartu aplikasi tidak ditampilkan setengah jadi": the failure leaves no
  // cards behind — neither a stale list nor a partial render.
  record('US-A06 AC4', 'no app card is left on screen under the error',
    await errorState.locator('[data-app-card]').count() === 0);

  // The retry must actually re-request and recover.
  await retry.click();
  await page.locator('[data-state="ready"]').waitFor({ state: 'visible', timeout: 10000 });
  const recovered = await page.locator('[data-state="ready"] [data-app-card]').count();
  record('US-A06 AC4', 'retry re-requests and the list recovers', recovered >= 2, `cards=${recovered}`);
  await page.unroute('**/api/apps');
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
