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

/**
 * Direct DB access for fixtures the HTTP API cannot create.
 *
 * `POST /api/auth/register` always makes its caller an `admin` (US-A01 AC1), so
 * the only way to get a `viewer` to test US-A04 AC1 with is to write the row.
 * Password hashing mirrors src/lib/password.ts (scrypt, `salt.hex`).
 */
async function pgPool() {
  const { Pool } = await import('pg');
  return new Pool({ connectionString: process.env.PLATFORM_DATABASE_URL });
}

async function hashPw(pw) {
  const { randomBytes, scrypt } = await import('node:crypto');
  const { promisify } = await import('node:util');
  const salt = randomBytes(16).toString('hex');
  const dk = await promisify(scrypt)(pw, salt, 64);
  return `${salt}.${dk.toString('hex')}`;
}

async function createUser({ email, password, name, role, orgId }) {
  const { randomBytes } = await import('node:crypto');
  const pool = await pgPool();
  const id = randomBytes(8).toString('hex');
  await pool.query(
    `INSERT INTO users (id, email, name, org_id, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, email, name, orgId, role, await hashPw(password)],
  );
  await pool.end();
  return id;
}

/** Delete dependents before the parent: users reference organizations (US-A01 schema). */
async function dropUserAndOrg(userId, orgId) {
  const pool = await pgPool();
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  if (orgId) await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
  await pool.end();
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

// ── US-A04 AC1: `viewer` is refused server-side on writes -------------------
// The AC is explicit that hiding the button is not enough, so every probe below
// hits the endpoint directly with a real viewer session. The read-back at the
// end is what proves the refusal was real: a 403 that still wrote the row would
// pass a status-only assertion.
{
  const adminCookies = cookies;
  const viewerEmail = `viewer-ac1-${Date.now()}@seed.dev`;
  const viewerPw = 'viewertest123';
  const viewerId = await createUser({
    email: viewerEmail, password: viewerPw, name: 'Viewer AC1', role: 'viewer', orgId: 'seed-org-1',
  });

  // Baseline: the name we expect to still be there afterwards. Read through the
  // list endpoint — /api/apps/[id] has no GET handler, so it answers 405.
  const beforeList = await json(await req('/api/apps'));
  const before = (beforeList?.apps || []).find((a) => a.id === 'app-1');

  const login = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: viewerEmail, password: viewerPw }),
  });
  record('US-A04 AC1', 'viewer session established', login.status === 200, `status=${login.status}`);

  const pw = await req('/api/apps/app-1', {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Viewer Was Here' }),
  });
  record('US-A04 AC1', 'viewer PATCH app -> 403', pw.status === 403, `status=${pw.status}`);

  const pg = await req('/api/apps/app-1/pages', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Viewer Page' }),
  });
  record('US-A04 AC1', 'viewer POST page -> 403', pg.status === 403, `status=${pg.status}`);

  const dr = await req('/api/apps/app-1/data', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ row_json: { viewer: true } }),
  });
  record('US-A04 AC1', 'viewer POST data row -> 403', dr.status === 403, `status=${dr.status}`);

  const wf = await req('/api/apps/app-1/workflows', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Viewer Flow', trigger_type: 'button' }),
  });
  record('US-A04 AC1', 'viewer POST workflow -> 403', wf.status === 403, `status=${wf.status}`);

  const del = await req('/api/apps/app-1', { method: 'DELETE' });
  record('US-A04 AC1', 'viewer DELETE app -> 403', del.status === 403, `status=${del.status}`);

  // Read-back as the admin: the row must be byte-identical to the baseline.
  cookies = adminCookies;
  const afterList = await json(await req('/api/apps'));
  const after = (afterList?.apps || []).find((a) => a.id === 'app-1');
  record('US-A04 AC1', 'app row unchanged after viewer writes',
    !!after && after.id === before?.id && after.name === before?.name,
    `before=${before?.name} after=${after?.name}`);

  await dropUserAndOrg(viewerId, null);
}

// ── US-A04 AC6: another workspace's app is 403, and reveals nothing ---------
// The AC names 403 for a known row in workspace X. A guessed id that exists in
// NO workspace is a different case and answers 404 — both are asserted so the
// two paths cannot silently collapse into one another.
{
  const adminCookies = cookies;
  const outsiderEmail = `outsider-ac6-${Date.now()}@seed.dev`;
  const outsiderPw = 'outsider123';

  const reg = await req('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Outsider', workspace_name: `Outsider WS ${Date.now()}`, email: outsiderEmail,
      password: outsiderPw, confirm: outsiderPw,
    }),
  });
  const regBody = await json(reg);
  record('US-A04 AC6', 'second workspace + admin created', reg.status === 201 && !!regBody?.workspace?.id,
    `status=${reg.status}`);
  const outsiderOrg = regBody?.workspace?.id;

  // /api/apps list is scoped by org, so a fresh workspace starts empty.
  const list = await req('/api/apps');
  const listBody = await json(list);
  record('US-A04 AC6', 'outsider sees none of the seed workspace apps',
    list.status === 200 && Array.isArray(listBody?.apps) && listBody.apps.length === 0,
    `count=${listBody?.apps?.length}`);

  const probes = [
    ['PATCH app', () => req('/api/apps/app-1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Outsider Was Here' }) })],
    ['DELETE app', () => req('/api/apps/app-1', { method: 'DELETE' })],
    ['GET app pages', () => req('/api/apps/app-1/pages')],
    ['GET app data', () => req('/api/apps/app-1/data')],
    ['POST app data', () => req('/api/apps/app-1/data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ row_json: { x: 1 } }) })],
    ['GET app workflows', () => req('/api/apps/app-1/workflows')],
    ['POST app publish', () => req('/api/apps/app-1/publish', { method: 'POST' })],
  ];
  for (const [label, probe] of probes) {
    const r = await probe();
    const body = await json(r);
    const leaks = JSON.stringify(body ?? '').includes('Welcome App');
    record('US-A04 AC6', `outsider ${label} -> 403, no app data leaked`,
      r.status === 403 && !leaks, `status=${r.status} leaked=${leaks}`);
  }

  // Control: an id that exists nowhere is 404, not 403. Probed through a route
  // that actually has a GET handler — /api/apps/[id] only exports PATCH/DELETE,
  // so hitting it would answer 405 and prove nothing.
  const missing = await req('/api/apps/does-not-exist-ac6/data');
  record('US-A04 AC6', 'unknown id -> 404 (distinct from cross-workspace 403)',
    missing.status === 404, `status=${missing.status}`);

  // Read-back as admin: the publish probe above must not have flipped the flag.
  cookies = adminCookies;
  const nowList = await json(await req('/api/apps'));
  const appNow = (nowList?.apps || []).find((a) => a.id === 'app-1');
  record('US-A04 AC6', 'seed app untouched after outsider probes',
    !!appNow && appNow.name === 'Welcome App', `name=${appNow?.name}`);

  await dropUserAndOrg(regBody?.user?.id, outsiderOrg);
}

// ── US-A04 AC6: the guard holds on nested resources too ---------------------
// An app is only one of the rows that can leak. A page, component, workflow or
// step carries an id that is just as guessable, and each is reached through a
// different route file. This builds a full object graph inside a SECOND
// workspace and then, from the seed admin's session, touches every id in it.
// All of them must answer 403 and leave the graph intact.
{
  const seedAdmin = cookies;
  const tag = Date.now();
  const outsiderEmail = `nested-ac6-${tag}@seed.dev`;
  const outsiderPw = 'nested123';

  const reg = await req('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Nested Outsider', workspace_name: `Nested WS ${tag}`, email: outsiderEmail,
      password: outsiderPw, confirm: outsiderPw,
    }),
  });
  const regBody = await json(reg);
  const outsiderOrg = regBody?.workspace?.id;
  record('US-A04 AC6', 'nested: second workspace created', reg.status === 201, `status=${reg.status}`);

  // Build the graph through the real API, as its owner. Anything the API cannot
  // make is not worth guarding, so using the HTTP path is the point here.
  const appRes = await json(await req('/api/apps', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Outsider App', slug: `outsider-${tag}` }),
  }));
  const oApp = appRes?.app?.id;
  const pageRes = await json(await req(`/api/apps/${oApp}/pages`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Outsider Page' }),
  }));
  const oPage = pageRes?.page?.id;
  const compRes = await json(await req(`/api/pages/${oPage}/components`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'text' }),
  }));
  const oComp = compRes?.component?.id;
  const wfRes = await json(await req(`/api/apps/${oApp}/workflows`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Outsider Flow', trigger_type: 'button' }),
  }));
  const oWf = wfRes?.workflow?.id;
  const stepRes = await json(await req(`/api/workflows/${oWf}/steps`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action_type: 'send_email' }),
  }));
  const oStep = stepRes?.step?.id;
  record('US-A04 AC6', 'nested: object graph built in the second workspace',
    !!(oApp && oPage && oComp && oWf && oStep),
    `app=${!!oApp} page=${!!oPage} comp=${!!oComp} wf=${!!oWf} step=${!!oStep}`);

  // Count what exists before the probes, so "nothing was touched" is measured.
  const pool = await pgPool();
  const before = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM pages WHERE app_id = $1)      AS pages,
       (SELECT COUNT(*)::int FROM components c JOIN pages p ON p.id = c.page_id WHERE p.app_id = $1) AS comps,
       (SELECT COUNT(*)::int FROM workflows WHERE app_id = $1)  AS wfs,
       (SELECT COUNT(*)::int FROM workflow_steps s JOIN workflows w ON w.id = s.workflow_id WHERE w.app_id = $1) AS steps`,
    [oApp],
  );

  // Now switch to the SEED admin — a legitimate admin of a DIFFERENT workspace.
  cookies = seedAdmin;

  const nested = [
    ['GET page components', () => req(`/api/pages/${oPage}/components`)],
    ['POST page components', () => req(`/api/pages/${oPage}/components`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'text' }) })],
    ['POST page duplicate', () => req(`/api/pages/${oPage}/duplicate`, { method: 'POST' })],
    ['PATCH component', () => req(`/api/components/${oComp}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config_json: { pwned: true } }) })],
    ['DELETE component', () => req(`/api/components/${oComp}`, { method: 'DELETE' })],
    ['GET workflow steps', () => req(`/api/workflows/${oWf}/steps`)],
    ['POST workflow steps', () => req(`/api/workflows/${oWf}/steps`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action_type: 'send_email' }) })],
    ['PATCH workflow toggle', () => req(`/api/workflows/${oWf}/toggle`, { method: 'PATCH' })],
    ['PATCH workflow step', () => req(`/api/workflow-steps/${oStep}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on_error: 'stop' }) })],
    ['DELETE workflow step', () => req(`/api/workflow-steps/${oStep}`, { method: 'DELETE' })],
  ];
  for (const [label, probe] of nested) {
    const r = await probe();
    const body = await json(r);
    const leaks = JSON.stringify(body ?? '').includes('Outsider');
    record('US-A04 AC6', `nested ${label} -> 403, no data leaked`,
      r.status === 403 && !leaks, `status=${r.status} leaked=${leaks}`);
  }

  // Read-back: the row counts must be identical. A 403 that still wrote would
  // pass every assertion above.
  const after = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM pages WHERE app_id = $1)      AS pages,
       (SELECT COUNT(*)::int FROM components c JOIN pages p ON p.id = c.page_id WHERE p.app_id = $1) AS comps,
       (SELECT COUNT(*)::int FROM workflows WHERE app_id = $1)  AS wfs,
       (SELECT COUNT(*)::int FROM workflow_steps s JOIN workflows w ON w.id = s.workflow_id WHERE w.app_id = $1) AS steps`,
    [oApp],
  );
  const b = before.rows[0], a = after.rows[0];
  record('US-A04 AC6', 'nested: row counts unchanged after every probe',
    b.pages === a.pages && b.comps === a.comps && b.wfs === a.wfs && b.steps === a.steps,
    `before=${JSON.stringify(b)} after=${JSON.stringify(a)}`);

  // The component's config must not have been written by the PATCH probe.
  const cfg = await pool.query('SELECT config_json FROM components WHERE id = $1', [oComp]);
  record('US-A04 AC6', 'nested: component config not modified by outsider PATCH',
    !JSON.stringify(cfg.rows[0]?.config_json ?? {}).includes('pwned'),
    `config=${JSON.stringify(cfg.rows[0]?.config_json)}`);

  // Teardown: apps first (no ON DELETE CASCADE from organizations), then the org.
  await pool.query('DELETE FROM apps WHERE org_id = $1', [outsiderOrg]);
  await pool.end();
  await dropUserAndOrg(regBody?.user?.id, outsiderOrg);
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
