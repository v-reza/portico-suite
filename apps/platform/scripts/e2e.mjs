#!/usr/bin/env node
/**
 * E2E API test for the Platform app.
 */
import { createHash, randomBytes } from 'node:crypto';

const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3001';
const results = [];
let cookies = '';
let lastSetCookieRaw = '';
let createdAppId = null;

function record(ac, name, pass, detail = '') {
  results.push({ ac, name, pass, detail });
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${ac.padEnd(14)} ${name}${detail ? `  — ${detail}` : ''}`);
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(cookies ? { cookie: cookies } : {}) },
    redirect: 'manual',
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  for (const c of sc) {
    const [pair] = c.split(';');
    const [name] = pair.split('=');
    if (name === 'po_session') { cookies = pair; lastSetCookieRaw = c; }
  }
  return res;
}

const json = async (r) => { try { return await r.json(); } catch { return null; } };

/**
 * Delete Redis keys straight from the test, using the same stdlib RESP approach
 * as apps/platform/src/lib/redis.ts. Only used to clean up throttle state this
 * suite created — a suite that leaves a 15-minute login block behind would fail
 * its own next run.
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

// ── US-A02: local login ---------------------------------------------------
{
  const r = await req('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@seed.dev', password: 'wrongpassword' }) });
  record('US-A02 AC2', 'wrong password refused', r.status === 401, `status=${r.status}`);
}
{
  const r = await req('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123' }) });
  record('US-A02 AC1', 'correct password logs in', r.status === 200, `status=${r.status}`);
  const b = await json(r);
  record('US-A02 AC1', 'session cookie set', !!cookies, `cookie=${cookies ? 'present' : 'MISSING'}`);
  record('US-A02 AC1', 'cookie is httpOnly + sameSite',
    /httponly/i.test(lastSetCookieRaw) && /samesite=lax/i.test(lastSetCookieRaw),
    lastSetCookieRaw.split(';').slice(1).join(';').trim() || 'NO FLAGS');
}

// ── US-A02 AC2: the refusal message must not say WHICH half was wrong ──────
{
  // Both probes are failures, so both leave a throttle counter behind. A suite
  // that runs 5 times would block `definitely-not-a-user@` and the AC2 check
  // would start seeing 429 instead of 401 — so clear them here.
  const unknownEmail = 'definitely-not-a-user@seed.dev';
  const wrongPwEmail = 'admin@seed.dev';

  const unknown = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: unknownEmail, password: 'whatever123' }),
  });
  const unknownBody = await json(unknown);
  const wrongPw = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: wrongPwEmail, password: 'wrongpassword' }),
  });
  const wrongPwBody = await json(wrongPw);
  record('US-A02 AC2', 'unknown email and wrong password give the SAME generic message',
    unknown.status === 401 && wrongPw.status === 401
      && unknownBody?.message === wrongPwBody?.message
      && !!unknownBody?.message,
    `unknown=${unknown.status}/${unknownBody?.message} wrongpw=${wrongPw.status}/${wrongPwBody?.message}`);

  await redisDel(
    `platform:login:fail:${unknownEmail}`,
    `platform:login:block:${unknownEmail}`,
    `platform:login:fail:${wrongPwEmail}`,
    `platform:login:block:${wrongPwEmail}`,
  );
}

// ── US-A02 AC3: 5 failures in 10 min for one email -> blocked 15 min ───────
{
  // A dedicated email so this never locks the seed admin out of the rest of the
  // suite, and so the counter is ours to clean up.
  const victim = `ac3-throttle-${Date.now()}@seed.dev`;
  const attempt = () => req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: victim, password: 'definitely-wrong' }),
  });

  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await attempt()).status);
  const blocked = await attempt();

  record('US-A02 AC3', 'first 5 failures are refused as 401 (a real wrong password, not a throttle)',
    codes.every((c) => c === 401), `codes=${codes.join(',')}`);
  record('US-A02 AC3', '6th attempt within the window is blocked with 429',
    blocked.status === 429, `status=${blocked.status}`);

  const retryAfter = Number(blocked.headers.get('retry-after'));
  // 15 minutes, allowing for the seconds already elapsed inside the window.
  record('US-A02 AC3', 'Retry-After reports the remaining block (<= 15 min, > 0)',
    Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 15 * 60,
    `retry-after=${blocked.headers.get('retry-after')}`);

  // AC3 blocks the EMAIL, so a correct password on a blocked email is still
  // refused — otherwise an attacker who guesses right mid-block gets in.
  const correctButBlocked = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: victim, password: 'seedadmin123' }),
  });
  record('US-A02 AC3', 'correct password on a blocked email is still refused (block is per-email)',
    correctButBlocked.status === 429, `status=${correctButBlocked.status}`);

  // Cleanup: lift our own block so the suite is re-runnable and leaves no state.
  await redisDel(`platform:login:fail:${victim}`, `platform:login:block:${victim}`);
}

// ── US-A02 AC4: expired session -> login -> back to the ORIGINAL page ──────
{
  const saved = cookies;
  cookies = '';
  const guarded = await req('/apps');
  const location = guarded.headers.get('location') ?? '';
  record('US-A02 AC4', 'guarded page redirects to /login carrying next=',
    guarded.status >= 300 && guarded.status < 400 && location.includes('/login?next='),
    `status=${guarded.status} location=${location}`);

  const deep = await req('/apps/app-1');
  const deepLocation = deep.headers.get('location') ?? '';
  record('US-A02 AC4', 'the deep-linked page is the one carried back, not a generic /apps',
    decodeURIComponent(deepLocation).includes('/apps/app-1'),
    `location=${deepLocation}`);

  // Log in with that `next` and assert the server hands the SAME path back.
  const r = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123', next: '/apps/app-1' }),
  });
  const b = await json(r);
  record('US-A02 AC4', 'login returns redirectTo = the requested page',
    r.status === 200 && b?.redirectTo === '/apps/app-1', `redirectTo=${b?.redirectTo}`);

  // An off-site `next` must not turn the login page into an open redirect.
  const evil = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123', next: 'https://evil.example/x' }),
  });
  const evilBody = await json(evil);
  record('US-A02 AC4', 'an off-site next is discarded, not followed',
    evil.status === 200 && evilBody?.redirectTo === '/apps', `redirectTo=${evilBody?.redirectTo}`);

  cookies = saved || cookies;
}

// ── US-A02 AC5: after logout the back button must not show app data ────────
{
  // Establish a fresh session, load the list, then log out.
  await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123' }),
  });
  const before = await req('/apps');
  const beforeHtml = await before.text();
  record('US-A02 AC5', 'app list is reachable while signed in (control for the logout check)',
    before.status === 200 && /Daftar Aplikasi|Welcome App/.test(beforeHtml),
    `status=${before.status} hasData=${/Daftar Aplikasi|Welcome App/.test(beforeHtml)}`);

  const out = await req('/api/auth/logout', { method: 'POST' });
  const cleared = (out.headers.getSetCookie?.() ?? []).join(' ');
  record('US-A02 AC5', 'logout expires the session cookie',
    out.status === 200 && /po_session=;/.test(cleared) && /Max-Age=0/i.test(cleared),
    cleared ? cleared.split(';').slice(0, 3).join(';') : 'NO SET-COOKIE');

  // This is the back-button path: re-request the page the user was just on.
  const after = await req('/apps');
  const afterHtml = await after.text();
  const redirected = after.status >= 300 && after.status < 400;
  const leaksData = /Welcome App|CRM Starter|Daftar Aplikasi/.test(afterHtml);
  record('US-A02 AC5', 'after logout the app page redirects away and its body carries no app data',
    redirected && !leaksData, `status=${after.status} leaksData=${leaksData}`);
  record('US-A02 AC5', 'the app page is no-store, so the browser cannot serve it from cache',
    (after.headers.get('cache-control') ?? '').includes('no-store'),
    `cache-control=${after.headers.get('cache-control')}`);

  // Restore a session: this block deliberately ended one, and the app tests
  // below need a signed-in jar.
  await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123' }),
  });
}

// ── US-A05/A06: apps ------------------------------------------------------
{
  const r = await req('/api/apps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Test App' }) });
  record('US-A05 AC1', 'create app returns 201', r.status === 201, `status=${r.status}`);
  const b = await json(r);
  record('US-A05 AC1', 'returns app id', !!b?.app?.id, `id=${b?.app?.id}`);
  createdAppId = b?.app?.id;
}

{
  const r = await req('/api/apps');
  const b = await json(r);
  record('US-A06 AC1', 'list apps', Array.isArray(b?.apps) && b.apps.length >= 2, `count=${b?.apps?.length}`);
}

// ── US-A29: health + ready -------------------------------------------------
{
  const r = await req('/health');
  const b = await json(r);
  record('US-A29 AC1', '/health is 200', r.status === 200 && b?.status === 'ok', `status=${r.status}`);
}
{
  const r = await req('/ready');
  const b = await json(r);
  record('US-A29 AC2', '/ready reports components', r.status === 200 && b?.components?.database?.status === 'up', `db=${b?.components?.database?.status}`);
}

// ── guard: unauthenticated -------------------------------------------------
{
  const saved = cookies;
  cookies = '';
  const r = await req('/api/apps');
  record('US-A04 AC5', 'no session -> 401', r.status === 401, `status=${r.status}`);
  cookies = saved;
}

// ── teardown: leave no fixture behind --------------------------------------
{
  const r = await req('/api/apps');
  const b = await json(r);
  const mine = (b?.apps || []).filter((a) => a.name === 'Test App');
  for (const a of mine) await req(`/api/apps/${a.id}`, { method: 'DELETE' });
  console.log(`  --   teardown: removed ${mine.length} fixture app(s)`);
}

console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
