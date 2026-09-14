#!/usr/bin/env node
/**
 * Browser test for the Hub. Run: node scripts/ui.mjs
 *
 * Drives a real Chromium against the running dev server and asserts on what the
 * page actually renders — DOM, navigation, cookie behaviour. The API suite
 * (e2e.mjs) proves the endpoints work; this proves a human can use them.
 *
 * Needs `npx playwright install chromium` once; the browser is cached under
 * %LOCALAPPDATA%\ms-playwright so it is not re-downloaded per run.
 */
import { chromium } from 'playwright';

const BASE = process.env.HUB_URL ?? 'http://localhost:3100';
const results = [];
let shot = 0;

function record(ac, what, pass, detail = '') {
  results.push({ ac, what, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${ac.padEnd(13)} ${what}${detail ? `  — ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// A React hydration mismatch or a thrown handler is invisible to status-code
// checks but breaks the page for a real user.
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

const email = () => page.locator('input[type="email"]');
const password = () => page.locator('input[type="password"]');
const submit = () => page.locator('button[type="submit"]');

async function goto(path) {
  // NOT `networkidle`: the Next dev server holds an HMR websocket open forever,
  // so networkidle never settles and every navigation times out.
  const r = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForLoadState('load').catch(() => {});
  return r?.status();
}
async function shotPage(name) {
  await page.screenshot({ path: `shots/ui-${String(++shot).padStart(2, '0')}-${name}.png` });
}
/**
 * Run one block in isolation. A thrown assertion must not abort the suite — a
 * crash hides every result after it, which is exactly when the list matters most.
 */
async function step(ac, label, fn) {
  try {
    await fn();
  } catch (e) {
    record(ac, label, false, String(e).split('\n')[0].slice(0, 120));
  }
}
const text = () => page.locator('body').innerText();

// ── US-M01: login ───────────────────────────────────────────────────────────

let DEMO_EMAIL = '';
let DEMO_PASS = '';

await step('US-M01 AC1', 'login page block', async () => {
  const st = await goto('/login');
  record('US-M01 AC1', 'login page renders', st === 200 && (await submit().count()) === 1, `status=${st}`);
  await shotPage('login');

  // US-M01 AC2: the page must advertise a working demo account. Read the
  // credentials OFF the page and use those — if the UI advertises something that
  // does not actually work, this fails, which is the point.
  const body = await text();
  const m = body.match(/([a-z0-9._-]+@[a-z0-9.-]+)\s*[·:]\s*([A-Za-z0-9!@#$%^&*_-]{6,})/i);
  DEMO_EMAIL = m?.[1] ?? '';
  DEMO_PASS = m?.[2] ?? '';
  record('US-M01 AC2', 'page advertises demo credentials', !!DEMO_EMAIL, DEMO_EMAIL || 'no demo block found');

  // wrong password must be refused and must NOT navigate away
  await email().fill('owner@portico.dev');
  await password().fill('definitely-not-the-password');
  await submit().click();
  await page.waitForTimeout(1500);
  record('US-M01 AC2', 'wrong password is refused', page.url().endsWith('/login'), `url=${page.url().replace(BASE, '')}`);
  record('US-M01 AC2', 'wrong password shows a message', /salah|tidak cocok|invalid/i.test(await text()), '');

  // the padded demo credential must actually log in
  await email().fill(DEMO_EMAIL);
  await password().fill(DEMO_PASS);
  await submit().click();
  await page.waitForURL(/pilih-app/, { timeout: 20000 }).catch(() => {});
  record('US-M01 AC1', 'advertised demo credentials log in', page.url().includes('pilih-app'), `url=${page.url().replace(BASE, '')}`);
  await shotPage('after-login');

  // the session cookie must not be readable by JavaScript
  const sc = (await ctx.cookies()).find((c) => c.name === 'hub_session');
  record('US-M01 AC1', 'session cookie set', !!sc, sc?.name ?? 'MISSING');
  record('US-M01 AC1', 'session cookie is httpOnly', sc?.httpOnly === true, `httpOnly=${sc?.httpOnly}`);
  record('US-M01 AC1', 'session cookie is SameSite', ['Lax', 'Strict'].includes(sc?.sameSite), `sameSite=${sc?.sameSite}`);
});

// ── US-M03: pilih app ───────────────────────────────────────────────────────

await step('US-M03 AC1', 'pilih-app block', async () => {
  const st = await goto('/pilih-app');
  await page.waitForTimeout(1200); // client-side fetch of /api/hub/apps
  const body = await text();
  // This page must NOT have the app chrome — it is a bare 560px card.
  const hasChrome = (await page.locator('nav, aside').count()) > 0;
  record('US-M03 AC1', 'pilih-app renders', st === 200, `status=${st}`);
  record('US-M03 AC1', 'pilih-app has no app chrome', !hasChrome, `nav/aside=${hasChrome}`);
  record('US-M03 AC2', 'pilih-app lists the apps', /Platform|Helpdesk|Code Review/i.test(body), body.replace(/\s+/g, ' ').slice(0, 70));
  await shotPage('pilih-app');
});

// ── US-M11: admin console ───────────────────────────────────────────────────

await step('US-M11 AC1', 'users block', async () => {
  const st = await goto('/pengguna');
  await page.waitForTimeout(1500);
  const body = await text();
  record('US-M11 AC1', 'users page renders', st === 200, `status=${st}`);
  record('US-M11 AC1', 'users table is populated from the DB', /@portico\.dev/.test(body), '');
  const rows = await page.locator('tbody tr').count();
  record('US-M11 AC1', 'users table has rows', rows >= 3, `rows=${rows}`);
  await shotPage('pengguna');
});

await step('US-M11 AC4', 'roles block', async () => {
  const st = await goto('/peran');
  await page.waitForTimeout(1500);
  const body = await text();
  record('US-M11 AC4', 'roles page renders', st === 200, `status=${st}`);
  record('US-M11 AC4', 'per-app vocabulary shown', /owner|admin|builder|viewer/i.test(body), '');
  record('US-M11 AC5', 'matrix states it is read-only', /baca-saja|read-only/i.test(body), '');
  await shotPage('peran');
});

// ── US-M08: status ──────────────────────────────────────────────────────────

await step('US-M08 AC2', 'status block', async () => {
  const st = await goto('/status-sistem');
  await page.waitForTimeout(2000);
  const body = await text();
  record('US-M08 AC2', 'status page renders', st === 200, `status=${st}`);
  record('US-M08 AC2', 'status shows live components', /database|redis|hub/i.test(body), '');
  await shotPage('status-sistem');
});

// ── US-M04: logout ──────────────────────────────────────────────────────────

await step('US-M04 AC1', 'logout block', async () => {
  await goto('/pengguna');
  const r = await page.request.post(`${BASE}/api/auth/logout`);
  record('US-M04 AC1', 'logout endpoint accepts the request', r.status() === 200, `status=${r.status()}`);
  record('US-M04 AC1', 'session cookie cleared', !(await ctx.cookies()).some((c) => c.name === 'hub_session'), '');

  // AC6: the guard must be server-side. A raw HTTP fetch (no JS, no client
  // redirect) returning 200 + admin HTML is the bug this asserts against.
  const raw = await ctx.request.get(`${BASE}/pengguna`, { maxRedirects: 0 });
  const loc = raw.headers()['location'] ?? '';
  record('US-M04 AC1', 'anonymous admin page is refused server-side', raw.status() === 307 || raw.status() === 302,
    `status=${raw.status()} location=${loc.replace(BASE, '')}`);
  record('US-M04 AC1', 'refusal points at login with a next= return path', /\/login/.test(loc) && /next=/.test(loc), loc.replace(BASE, ''));
});

// ── US-M10: SSO round trip (LAST — it leaves the origin) ────────────────────

await step('US-M10 AC1', 'sso block', async () => {
  await ctx.clearCookies();

  // AC4-ish: an anonymous /authorize must bounce to login and remember where the
  // user was going. Assert on the HTTP response, not on the rendered page — the
  // redirect is issued before any HTML exists.
  const qs =
    'client_id=platform&response_type=code&state=zzz' +
    `&redirect_uri=${encodeURIComponent('http://localhost:3001/api/auth/hub/callback')}` +
    '&code_challenge=' + 'a'.repeat(43) + '&code_challenge_method=S256';
  const anon = await ctx.request.get(`${BASE}/authorize?${qs}`, { maxRedirects: 0 });
  const anonLoc = decodeURIComponent(anon.headers()['location'] ?? '');
  record('US-M10 AC1', 'anonymous /authorize redirects to login', /\/login/.test(anonLoc), `status=${anon.status()}`);
  record('US-M10 AC1', 'login remembers the authorize request', /authorize/.test(anonLoc), '');

  // Follow it in the browser so the login page is exercised the way a user sees it.
  await goto(`/login?next=${encodeURIComponent('/authorize?' + qs)}`);
  await email().fill(DEMO_EMAIL);
  await password().fill(DEMO_PASS);
  await submit().click();
  await page.waitForTimeout(3500);
  await shotPage('sso-resume');

  // The browser follows the code redirect to the app. Nothing listens on :3001
  // yet (Platform is not built), so a connection error there is the *expected*
  // proof that the redirect happened — assert that, not a loaded page.
  let resumed = 'ok';
  try {
    await page.waitForURL(/localhost:3001/, { timeout: 8000 });
  } catch {
    resumed = page.url();
  }
  const reachedApp = /localhost:3001/.test(resumed) || /ERR_CONNECTION|chrome-error/.test(resumed);
  record('US-M10 AC1', 'browser resumed the pending authorize', reachedApp, `landed=${resumed.slice(0, 48)}`);

  // The real assertion: authenticated, /authorize must mint a code and hand it
  // to the app's redirect_uri. Do it over HTTP so the assertion does not depend
  // on a second app actually listening on :3001.
  const auth = await ctx.request.get(`${BASE}/authorize?${qs}`, { maxRedirects: 0 });
  const loc = auth.headers()['location'] ?? '';
  const code = /[?&]code=([^&]+)/.exec(loc)?.[1];
  record('US-M10 AC1', 'authenticated /authorize issues a code', !!code, `status=${auth.status()} loc=${loc.slice(0, 60)}`);
  record('US-M10 AC1', 'the code goes to the app redirect_uri', loc.startsWith('http://localhost:3001/'), loc.slice(0, 45));
  record('US-M10 AC1', 'state is echoed back verbatim', /[?&]state=zzz/.test(loc), '');

  // Open-redirect guard: a URI this client never registered must be refused, not
  // honoured. Without this the Hub is an open redirector.
  const evil = await ctx.request.get(
    `${BASE}/authorize?client_id=platform&response_type=code&state=x` +
      `&redirect_uri=${encodeURIComponent('http://evil.example/steal')}` +
      '&code_challenge=' + 'a'.repeat(43) + '&code_challenge_method=S256',
    { maxRedirects: 0 },
  );
  record('US-M10 AC1', 'unregistered redirect_uri is refused', evil.status() === 400, `status=${evil.status()}`);

});

// ── hygiene ─────────────────────────────────────────────────────────────────

record('HYGIENE', 'no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `, ${failed.length} FAILED` : ''}`);
if (failed.length) {
  console.log('\nfailures:');
  for (const f of failed) console.log(`  ${f.ac}  ${f.what}  ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
