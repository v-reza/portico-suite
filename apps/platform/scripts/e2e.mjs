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

/**
 * Delete dependents before the parent (US-A01 schema): users and organizations
 * are both referenced by `activity_logs` (US-A05 AC4 writes one per app), so the
 * audit rows go first. Deleting the user first raises 23503 and aborts the rest
 * of the teardown, silently leaving the workspace behind.
 */
async function dropUserAndOrg(userId, orgId) {
  const pool = await pgPool();
  if (userId) await pool.query('DELETE FROM activity_logs WHERE user_id = $1', [userId]);
  if (orgId) await pool.query('DELETE FROM activity_logs WHERE org_id = $1', [orgId]);
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

// ── US-A05: create an app (draft) ------------------------------------------
// Every assertion below reads the row back. A 201 on its own cannot tell a
// draft from a published app, cannot prove the slug was made unique, and cannot
// prove the audit entry exists — which is exactly what the four ACs ask for.
{
  const tag = Date.now();
  const appName = `Intake Vendor ${tag}`;
  const ids = [];

  const listCount = async () => {
    const b = await json(await req('/api/apps'));
    return (b?.apps || []).length;
  };
  const before = await listCount();

  // AC1 — name in, draft out, and the caller gets the id the editor opens on.
  let first;
  {
    const r = await req('/api/apps', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: appName, description: 'Dibuat oleh e2e.mjs' }),
    });
    const b = await json(r);
    first = b?.app;
    if (first?.id) ids.push(first.id);
    record('US-A05 AC1', 'create app returns 201 with a new id',
      r.status === 201 && !!first?.id, `status=${r.status} id=${first?.id}`);
    record('US-A05 AC1', 'the created app is a draft (is_published=false)',
      first?.is_published === false, `is_published=${first?.is_published}`);
  }

  // AC1 read-back: the draft is persisted, not merely echoed back.
  {
    const b = await json(await req('/api/apps'));
    const row = (b?.apps || []).find((a) => a.id === first?.id);
    record('US-A05 AC1', 'the draft is readable from the list as a draft',
      !!row && row.is_published === false && row.name === appName,
      `found=${!!row} is_published=${row?.is_published}`);
  }

  // AC1 "dia masuk ke editor": the editor route serves that app to the caller.
  {
    const r = await req(`/apps/${first?.id}`);
    const html = await r.text().catch(() => '');
    record('US-A05 AC1', 'the created app opens in the editor',
      r.status === 200 && html.includes(appName),
      `status=${r.status} carriesAppName=${html.includes(appName)}`);
  }

  // AC2 — an empty name is refused, and nothing is written. The count is the
  // assertion: a 400 that still inserted a row would pass a status-only check.
  {
    const mid = await listCount();
    for (const body of [{ name: '' }, { name: '   ' }, {}]) {
      const r = await req('/api/apps', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const b = await json(r);
      record('US-A05 AC2', `empty name ${JSON.stringify(body)} -> 400 with a field message`,
        r.status === 400 && b?.error === 'name_required' && typeof b?.message === 'string' && b.message.length > 0,
        `status=${r.status} error=${b?.error}`);
    }
    record('US-A05 AC2', 'no app row was created by the refused requests',
      (await listCount()) === mid, `before=${mid} after=${await listCount()}`);
  }

  // AC3 — the same name again is NOT an error: the slug is made unique.
  let second;
  {
    const r = await req('/api/apps', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: appName }),
    });
    const b = await json(r);
    second = b?.app;
    if (second?.id) ids.push(second.id);
    record('US-A05 AC3', 'a duplicate name is accepted (201), not refused',
      r.status === 201 && !!second?.id, `status=${r.status}`);
    record('US-A05 AC3', 'the second app got a different, suffixed slug',
      !!second?.slug && second.slug !== first?.slug && /-\d+$/.test(second.slug),
      `first=${first?.slug} second=${second?.slug}`);
  }

  // AC3 under concurrency: five identical names at once. The losers of the slug
  // race must retry into a fresh value — a lookup-then-INSERT that re-reads the
  // same answer surfaces here as a 500, which is the failure this probe exists
  // for. Zero 5xx and five distinct slugs is the pass condition.
  {
    const burst = await Promise.all(
      Array.from({ length: 5 }, () =>
        req('/api/apps', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: `Burst App ${tag}` }),
        }),
      ),
    );
    const bodies = await Promise.all(burst.map(json));
    const slugs = bodies.map((b) => b?.app?.slug).filter(Boolean);
    for (const b of bodies) if (b?.app?.id) ids.push(b.app.id);
    const statuses = burst.map((r) => r.status);
    record('US-A05 AC3', 'burst of 5 identical names: zero 5xx',
      statuses.every((s) => s < 500), `statuses=${statuses.join(',')}`);
    record('US-A05 AC3', 'burst of 5 identical names: all 5 slugs distinct',
      slugs.length === 5 && new Set(slugs).size === 5, `slugs=${slugs.join(',')}`);
  }

  // AC4 — the creation is in the activity log, with the actor and the time.
  {
    const pool = await pgPool();
    const admin = await pool.query(`SELECT id FROM users WHERE email = 'admin@seed.dev'`);
    const logs = await pool.query(
      `SELECT user_id, action, entity_type, entity_id, created_at
       FROM activity_logs WHERE entity_id = ANY($1::text[]) ORDER BY created_at`,
      [ids],
    );
    await pool.end();
    const mine = logs.rows.filter((r) => r.entity_id === first?.id);
    record('US-A05 AC4', 'creating an app writes an activity_log row',
      mine.length === 1, `rows=${mine.length}`);
    record('US-A05 AC4', 'the log entry names the actor (pelaku)',
      mine[0]?.user_id === admin.rows[0]?.id,
      `user_id=${mine[0]?.user_id} admin=${admin.rows[0]?.id}`);
    const age = mine[0] ? Date.now() - new Date(mine[0].created_at).getTime() : Infinity;
    record('US-A05 AC4', 'the log entry carries the time (waktu) of the action',
      age >= 0 && age < 120000 && mine[0]?.action === 'app_created',
      `action=${mine[0]?.action} ageMs=${age}`);
  }

  // Teardown — this suite's own rows, children first (activity_logs references
  // the org and the user, apps only the org). Counts are printed so a teardown
  // that threw halfway cannot look like a clean one.
  {
    const pool = await pgPool();
    const logged = await pool.query('DELETE FROM activity_logs WHERE entity_id = ANY($1::text[])', [ids]);
    const apps = await pool.query('DELETE FROM apps WHERE id = ANY($1::text[])', [ids]);
    const left = await pool.query('SELECT count(*)::int n FROM apps WHERE id = ANY($1::text[])', [ids]);
    const total = await pool.query(`SELECT count(*)::int n FROM apps WHERE org_id = 'seed-org-1'`);
    await pool.end();
    record('US-A05 AC1', 'fixtures removed and the org is back to its seed app count',
      Number(left.rows[0].n) === 0 && Number(total.rows[0].n) === before,
      `deleted_apps=${apps.rowCount} deleted_logs=${logged.rowCount} remaining=${left.rows[0].n} org_apps=${total.rows[0].n} (was ${before})`);
  }
}

{
  const r = await req('/api/apps');
  const b = await json(r);
  record('US-A06 AC1', 'list apps', Array.isArray(b?.apps) && b.apps.length >= 2, `count=${b?.apps?.length}`);

  // AC1 is a contract about the FIELDS the list must carry — a card can only
  // show name/slug/description/status/last-modified if the endpoint sends all
  // five. Asserting the shape here keeps the browser test about rendering.
  const row = (b?.apps ?? [])[0] ?? {};
  const required = ['id', 'name', 'slug', 'description', 'is_published', 'updated_at'];
  const missing = required.filter((f) => !(f in row));
  record('US-A06 AC1', 'each list row carries the five fields the card renders',
    missing.length === 0, `missing=${missing.join(',') || 'none'} keys=${Object.keys(row).join(',')}`);
  // `created_at` would make the timestamp a lie the moment an app is edited.
  record('US-A06 AC1', 'the last-modified timestamp is updated_at, not created_at',
    'updated_at' in row && row.updated_at !== undefined,
    `updated_at=${row.updated_at}`);
}

// ── US-A06 AC5: 100 apps still list in under a second (p95) ---------------
// The AC is a latency claim, so it is measured: 100 rows are inserted for a
// throwaway workspace, the list is requested 20 times, and p95 is read off the
// real timings. A single warm request would not prove a p95.
{
  const tag = Date.now();
  const email = `a06-perf-${tag}@seed.dev`;
  const reg = await req('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Perf A06', workspace_name: `Perf WS ${tag}`, email,
      password: 'perfsecret123', confirm: 'perfsecret123',
    }),
  });
  const rb = await json(reg);
  const orgId = rb?.workspace?.id;
  record('US-A06 AC5', 'a 100-app workspace exists to measure', reg.status === 201 && !!orgId, `status=${reg.status}`);

  const pool = await pgPool();
  const before = Number((await pool.query('SELECT count(*)::int n FROM apps WHERE org_id = $1', [orgId])).rows[0].n);
  const values = Array.from({ length: 100 }, (_, i) => `($${i * 3 + 2}, $1, $${i * 3 + 3}, $${i * 3 + 4}, 'perf row')`);
  const params = [orgId];
  for (let i = 0; i < 100; i++) params.push(`perf-${tag}-${i}`, `Perf App ${i}`, `perf-${tag}-${i}`);
  await pool.query(
    `INSERT INTO apps (id, org_id, name, slug, description) VALUES ${values.join(',')}`,
    params,
  );
  const after = Number((await pool.query('SELECT count(*)::int n FROM apps WHERE org_id = $1', [orgId])).rows[0].n);
  record('US-A06 AC5', 'exactly 100 apps are in the workspace', after - before === 100, `before=${before} after=${after}`);

  // One warm request first: the AC is about the list being fast for a user who
  // is already on the page, not about JIT warm-up on a cold process.
  await req('/api/apps');
  const times = [];
  let lastCount = -1;
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const r = await req('/api/apps');
    times.push(performance.now() - t0);
    if (r.status !== 200) { times.push(Infinity); break; }
    lastCount = (await json(r))?.apps?.length ?? -1;
  }
  times.sort((a, b) => a - b);
  // p95 of 20 samples = the 19th value.
  const p95 = times[Math.min(times.length - 1, Math.ceil(0.95 * times.length) - 1)];
  const max = times[times.length - 1];
  record('US-A06 AC5', 'the list actually returns all 100 apps, not a truncated page',
    lastCount === 100, `apps=${lastCount}`);
  record('US-A06 AC5', 'p95 for listing 100 apps is under 1 second',
    p95 < 1000, `p95=${p95.toFixed(0)}ms max=${max.toFixed(0)}ms n=${times.length}`);

  // Teardown: children before parents (apps -> org -> user), or the FK refuses.
  await pool.query('DELETE FROM activity_logs WHERE org_id = $1', [orgId]);
  await pool.query('DELETE FROM app_data_rows WHERE app_id IN (SELECT id FROM apps WHERE org_id = $1)', [orgId]);
  await pool.query('DELETE FROM apps WHERE org_id = $1', [orgId]);
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
  const left = await pool.query(
    'SELECT (SELECT count(*)::int FROM apps WHERE org_id = $1) a, (SELECT count(*)::int FROM users WHERE email = $2) u',
    [orgId, email],
  );
  await pool.end();
  record('US-A06 AC5', 'the perf fixtures are gone (rows back to seed)',
    left.rows[0].a === 0 && left.rows[0].u === 0, `apps=${left.rows[0].a} users=${left.rows[0].u}`);

  // The registration above swapped the cookie jar to a user this block just
  // deleted; hand the session back to the seed admin the later blocks expect.
  await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123' }),
  });
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

// ── US-A04 AC6: the server-rendered page /apps/[id] must not leak either ──
// The API routes are guarded; the SSR page was the one gap (it carried the app's
// name, its pages and workflows to a visitor who was not in the owning
// workspace). The AC is about "tidak ada data yang terungkap", so the assertion
// is on the BODY of the HTML, not the status code.
//
// The probe uses its own app with a timestamped name rather than the seed's
// "Welcome App" alone: a generic word ("Home") would also appear in unrelated
// chrome, and a name the fixture controls cannot false-pass on coincidence.
{
  const seedAdmin = cookies;

  // Fixture built through the real API, as the seed admin, in the seed workspace.
  const tag = Date.now();
  const leakAppName = `AC6 Leak Probe ${tag}`;
  const leakPageName = `Leak Page ${tag}`;
  const made = await json(await req('/api/apps', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: leakAppName, slug: `ac6-leak-${tag}` }),
  }));
  const leakApp = made?.app?.id;
  const madePage = await json(await req(`/api/apps/${leakApp}/pages`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: leakPageName }),
  }));
  record('US-A04 AC6', 'page: leak-probe app + page created in the seed workspace',
    !!(leakApp && madePage?.page?.id), `app=${leakApp} page=${madePage?.page?.id}`);

  // Owner control FIRST, while the seed admin's session is still the current
  // one. Without it the guard could simply break the page for everyone and the
  // cross-tenant assertions below would still pass.
  const own = await req(`/apps/${leakApp}`);
  const ownHtml = await own.text();
  record('US-A04 AC6', 'page: owner GET renders the app name (control)',
    own.status === 200 && ownHtml.includes(leakAppName),
    `status=${own.status} hasName=${ownHtml.includes(leakAppName)}`);

  // A fresh workspace for the outsider (the AC needs a second org to exist).
  // Registering replaces the current cookie with the outsider's session, which
  // is exactly the session the cross-tenant probes below must run as.
  const outsiderEmail = `page-ac6-${tag}@seed.dev`;
  const outsiderPw = 'pageac6123';
  const reg = await req('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Page Outsider', workspace_name: `Page WS ${tag}`, email: outsiderEmail,
      password: outsiderPw, confirm: outsiderPw,
    }),
  });
  const regBody = await json(reg);
  record('US-A04 AC6', 'page: second workspace created', reg.status === 201 && !!regBody?.workspace?.id,
    `status=${reg.status}`);
  const outsiderOrg = regBody?.workspace?.id;

  // The outsider guesses both URLs: the fixture's, and the seed app-1 named in
  // the card's reproduction. Each case checks against THAT app's own page names
  // (read from the DB), not a hard-coded word — a generic string like "Home"
  // could also appear in unrelated page chrome and false-fail.
  const pool = await pgPool();
  const caseSecrets = [
    { label: 'fixture', id: leakApp, name: leakAppName },
    { label: 'seed app-1', id: 'app-1', name: 'Welcome App' },
  ];
  for (const c of caseSecrets) {
    const pageRows = await pool.query('SELECT name FROM pages WHERE app_id = $1', [c.id]);
    c.pages = pageRows.rows.map((x) => x.name);
  }

  for (const c of caseSecrets) {
    const cross = await req(`/apps/${c.id}`);
    // Read the body even though a redirect answers empty: if the guard ever
    // regressed to rendering, this is the call that would carry the leak.
    const crossHtml = await cross.text();
    const leakedApp = crossHtml.includes(c.name);
    const leakedPage = c.pages.find((p) => crossHtml.includes(p)) ?? null;
    record('US-A04 AC6', `page: outsider sees no app name from ${c.label} in the body`,
      !leakedApp, `status=${cross.status} leaked=${leakedApp}`);
    record('US-A04 AC6', `page: outsider sees no page name from ${c.label} in the body`,
      !leakedPage, `status=${cross.status} leakedPage=${leakedPage}`);
    // The refusal is the generic list redirect: no name, no page, no count.
    const loc = cross.headers.get('location') || '';
    record('US-A04 AC6', `page: outsider is redirected off the foreign page (${c.label})`,
      cross.status === 307 && loc.includes('/apps') && !leakedApp,
      `status=${cross.status} location=${loc}`);
  }

  // AC5 still holds: signed out, a deep link lands on /login carrying ?next=.
  cookies = '';
  const anon = await req(`/apps/${leakApp}`);
  const anonLoc = anon.headers.get('location') || '';
  record('US-A04 AC6', 'page: anon is redirected to /login (AC5 undamaged)',
    anon.status === 307 && anonLoc.includes('/login')
      && anonLoc.includes(encodeURIComponent(`/apps/${leakApp}`)),
    `status=${anon.status} location=${anonLoc}`);

  // Teardown: the fixture app (pages cascade), then the outsider's workspace.
  cookies = seedAdmin;
  await pool.query('DELETE FROM apps WHERE id = $1', [leakApp]);
  await pool.end();
  await dropUserAndOrg(regBody?.user?.id, outsiderOrg);
}

// ── teardown: leave no fixture behind --------------------------------------
// The US-A05 block deletes its own rows by id (and its activity_logs, which a
// name-based sweep would miss). What is left to check is that nothing this
// suite created is still around under the seed workspace.
{
  const pool = await pgPool();
  const stale = await pool.query(
    `SELECT count(*)::int n FROM apps
     WHERE org_id = 'seed-org-1' AND (name LIKE 'Intake Vendor %' OR name LIKE 'Burst App %')`,
  );
  await pool.end();
  record('US-A05 AC1', 'teardown: no fixture app left in the seed workspace',
    Number(stale.rows[0].n) === 0, `leftover=${stale.rows[0].n}`);
}

console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
