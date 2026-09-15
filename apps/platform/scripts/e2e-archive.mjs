#!/usr/bin/env node
/**
 * US-A07 — edit, archive, restore, permanent delete.
 *
 * Every assertion names the AC it proves and asserts that AC's own kind of
 * thing: a permission AC hits the endpoint with a real viewer session and reads
 * the row back, a state AC reads the new value, and the delete AC counts the
 * child rows that the cascade was supposed to take.
 *
 * Run: node scripts/e2e-archive.mjs   (needs the dev server on :3001 + .env)
 */
const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3001';
const results = [];
let cookies = '';

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
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    if (pair.split('=')[0] === 'po_session') cookies = pair;
  }
  return res;
}

const json = async (r) => { try { return await r.json(); } catch { return null; } };

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

/** `POST /api/auth/register` always makes its caller an admin (US-A01 AC1),
 *  so a `viewer` fixture has to be written directly. */
async function createUser({ email, password, name, role, orgId }) {
  const { randomBytes } = await import('node:crypto');
  const pool = await pgPool();
  const id = randomBytes(8).toString('hex');
  await pool.query(
    'INSERT INTO users (id, email, name, org_id, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, email, name, orgId, role, await hashPw(password)],
  );
  await pool.end();
  return id;
}

const pool = await pgPool();

/** Everything a permanent delete is supposed to cascade to (US-A07 AC5). */
async function childCounts(appId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM pages WHERE app_id = $1)          AS pages,
       (SELECT COUNT(*)::int FROM components c
          JOIN pages p ON p.id = c.page_id WHERE p.app_id = $1)     AS components,
       (SELECT COUNT(*)::int FROM workflows WHERE app_id = $1)      AS workflows,
       (SELECT COUNT(*)::int FROM workflow_steps s
          JOIN workflows w ON w.id = s.workflow_id WHERE w.app_id = $1) AS steps,
       (SELECT COUNT(*)::int FROM app_data_rows WHERE app_id = $1)  AS rows`,
    [appId],
  );
  return rows[0];
}

const cleanup = { apps: [], users: [] };

// ── setup: admin session + a fixture app with children ----------------------
{
  const r = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123' }),
  });
  record('US-A07 AC1', 'admin session established', r.status === 200, `status=${r.status}`);
}

const slug = `a07-fixture-${Date.now()}`;
let appId;
{
  const r = await req('/api/apps', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'A07 Fixture', slug, description: 'sebelum diubah' }),
  });
  const b = await json(r);
  appId = b?.app?.id;
  if (appId) cleanup.apps.push(appId);
  record('US-A07 AC1', 'fixture app created', r.status === 201 && !!appId, `status=${r.status}`);
}

// Children: a page, a component, a workflow, a step, a data row.
{
  const p = await json(await req(`/api/apps/${appId}/pages`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Form', route: '/' }),
  }));
  const pageId = p?.page?.id;
  await req(`/api/pages/${pageId}/components`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'text', config_json: { label: 'Nama' } }),
  });
  const w = await json(await req(`/api/apps/${appId}/workflows`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Notify', trigger_type: 'form_submit' }),
  }));
  await req(`/api/workflows/${w?.workflow?.id}/steps`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ step_order: 1, action_type: 'send_email', config_json: {} }),
  });
  await req(`/api/apps/${appId}/data`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ row_json: { vendor: 'PT Contoh' } }),
  });
  const c = await childCounts(appId);
  record('US-A07 AC5', 'fixture has pages/components/workflows/rows to cascade',
    c.pages >= 1 && c.components >= 1 && c.workflows >= 1 && c.steps >= 1 && c.rows >= 1,
    JSON.stringify(c));
}

// ── US-A07 AC1: rename + description change, updated_at moves ---------------
{
  const before = (await json(await req('/api/apps')))?.apps?.find((a) => a.id === appId);
  // Postgres `now()` is transaction-start time, so two writes inside the same
  // millisecond are legitimately equal. Wait one tick to make the assertion
  // about the column, not about clock resolution.
  await new Promise((r) => setTimeout(r, 1100));
  const r = await req(`/api/apps/${appId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'A07 Fixture (diubah)', description: 'sesudah diubah' }),
  });
  const b = await json(r);
  record('US-A07 AC1', 'PATCH accepted', r.status === 200, `status=${r.status}`);

  // Read back through the list endpoint — /api/apps/[id] exports no GET, so a
  // GET there would answer 405 and prove nothing about the write.
  const after = (await json(await req('/api/apps')))?.apps?.find((a) => a.id === appId);
  record('US-A07 AC1', 'name + description persisted on read-back',
    after?.name === 'A07 Fixture (diubah)' && after?.description === 'sesudah diubah',
    `name=${after?.name} desc=${after?.description}`);
  record('US-A07 AC1', 'updated_at moved forward',
    !!before && !!after && new Date(after.updated_at) > new Date(before.updated_at),
    `${before?.updated_at} -> ${after?.updated_at}`);
}

// ── US-A07 AC1 (failure path): an empty name is refused --------------------
{
  const r = await req(`/api/apps/${appId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '   ' }),
  });
  const after = (await json(await req('/api/apps')))?.apps?.find((a) => a.id === appId);
  record('US-A07 AC1', 'blank name refused (400) and name unchanged',
    r.status === 400 && after?.name === 'A07 Fixture (diubah)',
    `status=${r.status} name=${after?.name}`);
}

// ── US-A07 AC4: a viewer is refused on the archive endpoint, server-side -----
{
  const adminCookies = cookies;
  const viewerEmail = `a07-viewer-${Date.now()}@seed.dev`;
  const viewerPw = 'a07viewer123';
  const viewerId = await createUser({
    email: viewerEmail, password: viewerPw, name: 'A07 Viewer', role: 'viewer', orgId: 'seed-org-1',
  });
  cleanup.users.push(viewerId);

  cookies = '';
  const login = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: viewerEmail, password: viewerPw }),
  });
  record('US-A07 AC4', 'viewer session established', login.status === 200, `status=${login.status}`);

  const arch = await req(`/api/apps/${appId}/archive`, { method: 'POST' });
  record('US-A07 AC4', 'viewer POST archive -> 403 from the server', arch.status === 403, `status=${arch.status}`);

  const { rows } = await pool.query('SELECT archived_at FROM apps WHERE id = $1', [appId]);
  record('US-A07 AC4', 'archived_at still NULL after the refused call',
    rows[0]?.archived_at === null, `archived_at=${rows[0]?.archived_at}`);

  cookies = adminCookies;
}

// ── US-A07 AC2: archive hides it, kills the public link, keeps the data -----
{
  const beforeChildren = await childCounts(appId);

  // Publish first: the public-link half of AC2/AC3 is only observable on a link
  // that was working a moment ago.
  await req(`/api/apps/${appId}/publish`, { method: 'POST' });
  const live = await req(`/api/public/apps/${slug}`);
  record('US-A07 AC2', 'public link resolves before archiving (control)',
    live.status === 200, `status=${live.status}`);

  const arch = await req(`/api/apps/${appId}/archive`, { method: 'POST' });
  record('US-A07 AC2', 'archive accepted', arch.status === 200, `status=${arch.status}`);

  const listed = (await json(await req('/api/apps')))?.apps ?? [];
  record('US-A07 AC2', 'gone from the main list', !listed.some((a) => a.id === appId),
    `count=${listed.length} stillListed=${listed.some((a) => a.id === appId)}`);

  const pub = await req(`/api/public/apps/${slug}`);
  record('US-A07 AC2', 'public link stopped working', pub.status === 404, `status=${pub.status}`);

  const afterChildren = await childCounts(appId);
  record('US-A07 AC2', 'children not deleted',
    JSON.stringify(beforeChildren) === JSON.stringify(afterChildren),
    `before=${JSON.stringify(beforeChildren)} after=${JSON.stringify(afterChildren)}`);
}

// ── US-A07 AC3: restore brings the same slug back --------------------------
{
  const r = await req(`/api/apps/${appId}/restore`, { method: 'POST' });
  record('US-A07 AC3', 'restore accepted', r.status === 200, `status=${r.status}`);

  const listed = (await json(await req('/api/apps')))?.apps ?? [];
  const row = listed.find((a) => a.id === appId);
  record('US-A07 AC3', 'back in the main list with the same slug',
    !!row && row.slug === slug && row.archived_at === null,
    `slug=${row?.slug} archived_at=${row?.archived_at}`);

  const pub = await req(`/api/public/apps/${slug}`);
  const b = await json(pub);
  record('US-A07 AC3', 'public link works again on the same slug',
    pub.status === 200 && b?.app?.slug === slug, `status=${pub.status} slug=${b?.app?.slug}`);
}

// ── US-A07 AC5: permanent delete cascades and is logged --------------------
{
  const before = await childCounts(appId);
  const logBefore = await pool.query(
    "SELECT COUNT(*)::int AS n FROM activity_logs WHERE action = 'app_deleted' AND entity_id = $1",
    [appId],
  );

  const del = await req(`/api/apps/${appId}`, { method: 'DELETE' });
  record('US-A07 AC5', 'admin DELETE accepted', del.status === 200, `status=${del.status}`);

  const after = await childCounts(appId);
  record('US-A07 AC5', 'pages, components, workflows, steps and rows all gone',
    after.pages === 0 && after.components === 0 && after.workflows === 0 &&
    after.steps === 0 && after.rows === 0,
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);

  const gone = await pool.query('SELECT COUNT(*)::int AS n FROM apps WHERE id = $1', [appId]);
  record('US-A07 AC5', 'app row itself gone', gone.rows[0].n === 0, `rows=${gone.rows[0].n}`);

  const logAfter = await pool.query(
    "SELECT COUNT(*)::int AS n FROM activity_logs WHERE action = 'app_deleted' AND entity_id = $1",
    [appId],
  );
  record('US-A07 AC5', 'action recorded in the activity log',
    logBefore.rows[0].n === 0 && logAfter.rows[0].n === 1,
    `before=${logBefore.rows[0].n} after=${logAfter.rows[0].n}`);

  cleanup.apps = cleanup.apps.filter((x) => x !== appId);
}

// ── teardown ---------------------------------------------------------------
{
  for (const id of cleanup.apps) await req(`/api/apps/${id}`, { method: 'DELETE' });
  if (cleanup.users.length) {
    await pool.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [cleanup.users]);
  }
  await pool.query("DELETE FROM activity_logs WHERE entity_id = ANY($1::text[]) AND action = 'app_deleted'",
    [cleanup.apps.length ? cleanup.apps : ['']]);
  const leftover = await pool.query('SELECT COUNT(*)::int AS n FROM apps WHERE slug LIKE $1', ['a07-fixture-%']);
  console.log(`  --   teardown: ${cleanup.apps.length} app(s) + ${cleanup.users.length} user(s) removed, ` +
    `leftover fixture apps=${leftover.rows[0].n}`);
  await pool.end();
}

const pass = results.filter((r) => r.pass).length;
console.log(`\n${pass}/${results.length} passed${pass === results.length ? '' : `, ${results.length - pass} FAILED`}`);
process.exit(pass === results.length ? 0 : 1);
