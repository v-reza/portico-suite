#!/usr/bin/env node
/**
 * US-A08 — publish / unpublish control over an app's public link.
 *
 * Every assertion names the AC it proves and asserts that AC's own kind of
 * thing: a draft AC drives the public URL with no session, a state AC reads the
 * row back instead of trusting the status code, a permission AC hits the server
 * with a real viewer session, and the data AC counts rows before and after.
 *
 * Run: node scripts/e2e-publish.mjs   (needs the dev server on :3001 + .env)
 */
const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3001';
const results = [];
let cookies = '';

function record(ac, name, pass, detail = '') {
  results.push({ ac, name, pass, detail });
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${ac.padEnd(14)} ${name}${detail ? `  — ${detail}` : ''}`);
}

/** Session-aware request: sends the cookie jar when there is one. */
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

/**
 * Outsider request: never carries a session, whatever the jar holds. US-A08 is
 * about what someone WITHOUT an account can reach, so the "no session" cases
 * must not silently inherit the admin cookie.
 */
function anon(path, opts = {}) {
  return fetch(`${BASE}${path}`, { ...opts, redirect: 'manual' });
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
const cleanup = { apps: [], users: [], orgs: [] };

/** A second workspace, so the cross-tenant case (US-A04 AC6) has a real org to
 *  log in against — `users.org_id` is a foreign key, so it cannot be faked. */
async function createOrg(name) {
  const { randomBytes } = await import('node:crypto');
  const id = randomBytes(8).toString('hex');
  const slug = `a08-org-${id}`;
  await pool.query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)', [id, name, slug]);
  return id;
}

/** Rows this suite is responsible for, scoped to its own fixtures. */
async function rowCount(appId) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM app_data_rows WHERE app_id = $1', [appId]);
  return rows[0].n;
}

// ── setup ──────────────────────────────────────────────────────────────────
const STAMP = Date.now();
/** Every fixture this suite owns carries this prefix, so a crashed earlier run
 *  can be swept without touching a sibling suite's rows. */
const PREFIX = 'a08-';

/** Sweep leftovers of a crashed run: the UNIQUE(org_id, slug) on `apps` turns a
 *  leftover fixture into a 409 that looks like a broken endpoint. */
{
  const gone = await pool.query(`DELETE FROM apps WHERE slug LIKE $1 RETURNING id`, [`${PREFIX}%`]);
  // Users and orgs are swept too: a run that crashed before teardown leaves
  // them behind, and the next run's "fixtures are gone" check would then be
  // reading a leftover from the previous run rather than its own teardown.
  const users = await pool.query(`DELETE FROM users WHERE email LIKE $1 RETURNING id`, [`${PREFIX}%`]);
  const orgs = await pool.query(`DELETE FROM organizations WHERE slug LIKE $1 RETURNING id`, [`${PREFIX}%`]);
  if (gone.rowCount || users.rowCount || orgs.rowCount) {
    console.log(`  --   swept ${gone.rowCount} app(s), ${users.rowCount} user(s), ${orgs.rowCount} org(s)`);
  }
}

{
  const r = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123' }),
  });
  record('US-A08 AC2', 'admin session established', r.status === 200, `status=${r.status}`);
}

let appId;
/** The slug is derived server-side from the name (US-A05 AC3), so read it back
 *  instead of assuming it: the public URL is built from the real value. */
let slug;
{
  const r = await req('/api/apps', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `A08 Fixture ${STAMP}`, description: 'fixture US-A08' }),
  });
  const b = await json(r);
  appId = b?.app?.id;
  slug = b?.app?.slug;
  if (appId) cleanup.apps.push(appId);
  record('US-A08 AC1', 'fixture app created as a draft',
    r.status === 201 && b?.app?.is_published === false && !!slug,
    `status=${r.status} is_published=${b?.app?.is_published} slug=${slug}`);
}

// A page + a component, so "the link works" means real content is served rather
// than an empty shell that would pass either way.
{
  const p = await json(await req(`/api/apps/${appId}/pages`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Form', route: '/' }),
  }));
  await req(`/api/pages/${p?.page?.id}/components`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'text', config_json: { label: 'Nama Vendor' } }),
  });
}

// ── US-A08 AC1: a draft is not reachable through the public link ───────────
{
  // No session on purpose: AC1 is about what a visitor gets. The status code
  // alone is not the AC — the body must be the "belum dipublikasikan" answer and
  // it must not carry the app's name or any page content.
  const r = await anon(`/api/public/apps/${slug}`);
  const b = await json(r);
  record('US-A08 AC1', 'public GET on a draft -> 403, not 200/404',
    r.status === 403, `status=${r.status}`);
  record('US-A08 AC1', 'the answer is the "belum dipublikasikan" state',
    b?.error === 'unpublished' && b?.published === false,
    `error=${b?.error} published=${b?.published} message=${b?.message}`);
  record('US-A08 AC1', 'no app content leaks on the refusal',
    !b?.pages && !b?.app,
    `hasPages=${!!b?.pages} hasApp=${!!b?.app}`);

  // And the row itself is still a draft — the refusal is not a display trick.
  const { rows } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [appId]);
  record('US-A08 AC1', 'is_published is still false in the row',
    rows[0]?.is_published === false, `is_published=${rows[0]?.is_published}`);
}

// ── US-A08 AC1 (the page, not just the API): "muncul halaman" ──────────────
{
  // AC1 says the visitor sees a *page*, so the HTML is what gets asserted. A
  // JSON 403 would satisfy the API and still fail the story.
  const r = await anon(`/p/${slug}`);
  const html = await r.text();
  record('US-A08 AC1', 'the public PAGE on a draft renders the unpublished state',
    r.status === 200 && html.includes('Belum dipublikasikan'),
    `status=${r.status} hasHeading=${html.includes('Belum dipublikasikan')}`);

  // The page must not leak the app's own content while it is a draft.
  record('US-A08 AC1', 'the unpublished page does not render the app\'s form',
    !html.includes('Nama Vendor') && !html.includes('f_'),
    `leaksComponent=${html.includes('Nama Vendor')}`);

  // An unknown slug is a different answer from a draft one: 404, not the
  // "belum dipublikasikan" page, or the page would confirm slugs that exist.
  const unknown = await anon(`/p/a08-does-not-exist-${STAMP}`);
  record('US-A08 AC1', 'an unknown slug answers 404, not the unpublished page',
    unknown.status === 404, `status=${unknown.status}`);
}

// ── US-A08 AC2: publish flips the state and the link starts working ────────
{
  const r = await req(`/api/apps/${appId}/publish`, { method: 'POST' });
  const b = await json(r);
  record('US-A08 AC2', 'publish accepted', r.status === 200, `status=${r.status}`);
  record('US-A08 AC2', 'response reports the new state',
    b?.is_published === true, `is_published=${b?.is_published}`);

  // Read the column back — a 200 is not the AC, the persisted state is.
  const { rows } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [appId]);
  record('US-A08 AC2', 'is_published persisted as true',
    rows[0]?.is_published === true, `is_published=${rows[0]?.is_published}`);

  // "langsung bisa dipakai" — the public link serves the content right away.
  const pub = await anon(`/api/public/apps/${slug}`);
  const pb = await json(pub);
  record('US-A08 AC2', 'public link works immediately after publish',
    pub.status === 200 && pb?.app?.published === true, `status=${pub.status} published=${pb?.app?.published}`);
  record('US-A08 AC2', 'the public payload carries the real page + component',
    pb?.pages?.length === 1 && pb?.pages?.[0]?.components?.length === 1,
    `pages=${pb?.pages?.length} components=${pb?.pages?.[0]?.components?.length}`);
}

// ── US-A08 AC2 (the page): the link is usable right after publishing ───────
{
  const r = await anon(`/p/${slug}`);
  const html = await r.text();
  record('US-A08 AC2', 'the public PAGE serves the app\'s form after publish',
    r.status === 200 && html.includes('Nama Vendor'),
    `status=${r.status} hasField=${html.includes('Nama Vendor')}`);
  record('US-A08 AC2', 'the published page no longer shows the unpublished state',
    !html.includes('Belum dipublikasikan'),
    `hasUnpublished=${html.includes('Belum dipublikasikan')}`);
}

// ── US-A08 AC5: an outsider can submit, and cannot read back ───────────────
{
  const before = await rowCount(appId);

  // Seeded through the authenticated path first, so "cannot read previous rows"
  // is about a row that provably exists rather than about an empty table.
  await req(`/api/apps/${appId}/data`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ row_json: { vendor: 'PT Sebelumnya', rahasia: 'intern-only' } }),
  });

  // The outsider submission: no session, no cookie jar.
  const send = await anon(`/api/public/apps/${slug}/data`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ row_json: { vendor: 'PT Pengunjung' } }),
  });
  const sb = await json(send);
  record('US-A08 AC5', 'outsider POST to the public form -> 201, no session needed',
    send.status === 201 && sb?.ok === true, `status=${send.status} ok=${sb?.ok}`);

  const after = await rowCount(appId);
  record('US-A08 AC5', 'the submitted row is actually stored',
    after === before + 2, `before=${before} after=${after}`);

  // The "cannot read back" half. GET is what the authenticated data endpoint
  // implements; the public path must not answer it at all, and must not answer
  // 401 either — 401 would tell the visitor an endpoint is there.
  const read = await anon(`/api/public/apps/${slug}/data`);
  const rb = await json(read);
  record('US-A08 AC5', 'outsider GET on the public data path -> 405, no read route',
    read.status === 405, `status=${read.status}`);
  record('US-A08 AC5', 'the refusal leaks no row',
    !rb?.rows && !rb?.row, `hasRows=${!!rb?.rows} hasRow=${!!rb?.row}`);

  // And the private rows are still private: the authenticated list is what sees
  // them, and it refuses a caller with no session (US-A04 AC5).
  const priv = await anon(`/api/apps/${appId}/data`);
  const pv = await json(priv);
  record('US-A08 AC5', 'authenticated data endpoint refuses an anonymous caller -> 401',
    priv.status === 401 && !pv?.rows, `status=${priv.status} rows=${pv?.rows?.length}`);

  // The visitor never received the previously stored rows: the only body the
  // public path ever returned was the row id of what they themselves sent.
  record('US-A08 AC5', 'the 201 body carries only the new row id',
    !!sb?.id && sb?.rows === undefined && sb?.row_json === undefined,
    `keys=${Object.keys(sb ?? {}).join(',')}`);
}

// ── US-A08 AC3: unpublish closes the link and keeps the data ───────────────
{
  const before = await rowCount(appId);

  const r = await req(`/api/apps/${appId}/publish`, { method: 'POST' });
  const b = await json(r);
  record('US-A08 AC3', 'unpublish accepted (same toggle, other direction)',
    r.status === 200 && b?.is_published === false, `status=${r.status} is_published=${b?.is_published}`);

  const { rows } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [appId]);
  record('US-A08 AC3', 'is_published persisted as false',
    rows[0]?.is_published === false, `is_published=${rows[0]?.is_published}`);

  const pub = await anon(`/api/public/apps/${slug}`);
  const pb = await json(pub);
  record('US-A08 AC3', 'public link shows "belum dipublikasikan" again',
    pub.status === 403 && pb?.error === 'unpublished',
    `status=${pub.status} error=${pb?.error}`);

  const after = await rowCount(appId);
  record('US-A08 AC3', 'rows that had come in are NOT deleted',
    after === before && after > 0, `before=${before} after=${after}`);

  // AC3 says the link "kembali menampilkan halaman" — the page, again.
  const page = await anon(`/p/${slug}`);
  const html = await page.text();
  record('US-A08 AC3', 'the public PAGE shows "Belum dipublikasikan" again',
    page.status === 200 && html.includes('Belum dipublikasikan') && !html.includes('Nama Vendor'),
    `status=${page.status} hasHeading=${html.includes('Belum dipublikasikan')}`);

  // Submitting to a closed form must also be refused, and must not write.
  const send = await anon(`/api/public/apps/${slug}/data`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ row_json: { vendor: 'PT Terlambat' } }),
  });
  const afterSend = await rowCount(appId);
  record('US-A08 AC3', 'submit to an unpublished app -> 403 and no row written',
    send.status === 403 && afterSend === before,
    `status=${send.status} before=${before} afterSend=${afterSend}`);
}

// ── US-A08 AC4: an AI-created app stays a draft ────────────────────────────
{
  // A unique prompt per run: the generator derives the slug deterministically
  // from the prompt, so a fixed prompt collides on UNIQUE(org_id, slug) and
  // answers 409 on the second run.
  const r = await req('/api/ai/generate-app', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: `a08 draft check ${STAMP} audit tool` }),
  });
  const b = await json(r);
  const aiAppId = b?.app?.id;
  if (aiAppId) cleanup.apps.push(aiAppId);
  record('US-A08 AC4', 'AI generation produced an app',
    r.status === 201 && !!aiAppId, `status=${r.status} id=${aiAppId}`);

  // The response must say draft, and the row must agree with it.
  record('US-A08 AC4', 'the AI response marks the result as a draft',
    b?.app?.is_published === false && b?.is_draft === true,
    `is_published=${b?.app?.is_published} is_draft=${b?.is_draft}`);

  const { rows } = await pool.query('SELECT is_published, slug FROM apps WHERE id = $1', [aiAppId]);
  record('US-A08 AC4', 'is_published is false in the row, not just in the response',
    rows[0]?.is_published === false, `is_published=${rows[0]?.is_published}`);

  // "AI tidak boleh mempublikasikan sendiri" — the generated app's own public
  // link refuses, so nothing the AI did made it reachable.
  const pub = await anon(`/api/public/apps/${rows[0]?.slug}`);
  const pb = await json(pub);
  record('US-A08 AC4', 'the AI app is unreachable through its public link',
    pub.status === 403 && pb?.error === 'unpublished',
    `status=${pub.status} error=${pb?.error}`);

  // And generating did not publish an unrelated app as a side effect: the
  // fixture above is still unpublished at this point.
  const { rows: other } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [appId]);
  record('US-A08 AC4', 'generation did not publish the other app as a side effect',
    other[0]?.is_published === false, `fixture is_published=${other[0]?.is_published}`);

  // The AI path exposes no publish call of its own — the only way this app can
  // ever become public is a human hitting the publish endpoint.
  await req(`/api/apps/${aiAppId}/publish`, { method: 'POST' });
  const { rows: nowPublished } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [aiAppId]);
  record('US-A08 AC4', 'only an explicit publish call flips it (human action, not generation)',
    nowPublished[0]?.is_published === true, `after explicit publish=${nowPublished[0]?.is_published}`);
}

// ── US-A04 AC1: the publish endpoint is guarded server-side ────────────────
{
  const adminCookies = cookies;
  const viewerEmail = `a08-viewer-${STAMP}@seed.dev`;
  const viewerPw = 'a08viewer123';
  const viewerId = await createUser({
    email: viewerEmail, password: viewerPw, name: 'A08 Viewer', role: 'viewer', orgId: 'seed-org-1',
  });
  cleanup.users.push(viewerId);

  // Back to draft first, so a refused call is observable as "still draft".
  // The endpoint is a toggle, so the state has to be read before deciding
  // whether one call is enough — a blind call would leave it published and the
  // "unchanged" assertion below would then be asserting the wrong baseline.
  {
    const { rows } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [appId]);
    if (rows[0]?.is_published) await req(`/api/apps/${appId}/publish`, { method: 'POST' });
    const { rows: now } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [appId]);
    record('US-A04 AC1', 'baseline is a draft before the refused call',
      now[0]?.is_published === false, `is_published=${now[0]?.is_published}`);
  }

  cookies = '';
  const login = await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: viewerEmail, password: viewerPw }),
  });
  record('US-A04 AC1', 'viewer session established', login.status === 200, `status=${login.status}`);

  const pub = await req(`/api/apps/${appId}/publish`, { method: 'POST' });
  record('US-A04 AC1', 'viewer POST publish -> 403 from the server', pub.status === 403, `status=${pub.status}`);

  const { rows } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [appId]);
  record('US-A04 AC1', 'is_published unchanged after the refused call',
    rows[0]?.is_published === false, `is_published=${rows[0]?.is_published}`);

  // Cross-workspace: a second workspace's admin must not reach this app either
  // (US-A04 AC6). The app id is guessed, the session is real.
  const otherOrgId = await createOrg(`A08 Outsider ${STAMP}`);
  cleanup.orgs.push(otherOrgId);
  const otherAdminEmail = `a08-otheradmin-${STAMP}@seed.dev`;
  const otherAdminId = await createUser({
    email: otherAdminEmail, password: 'a08other123', name: 'A08 Other Admin', role: 'admin', orgId: otherOrgId,
  });
  cleanup.users.push(otherAdminId);

  cookies = '';
  await req('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: otherAdminEmail, password: 'a08other123' }),
  });
  const cross = await req(`/api/apps/${appId}/publish`, { method: 'POST' });
  record('US-A04 AC6', 'admin of another workspace POST publish -> 403', cross.status === 403, `status=${cross.status}`);

  const { rows: after } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [appId]);
  record('US-A04 AC6', 'cross-workspace attempt changed nothing',
    after[0]?.is_published === false, `is_published=${after[0]?.is_published}`);

  cookies = adminCookies;
}

// ── US-A08 AC3: the endpoint is a toggle, and the second call is the undo ──
{
  const on = await json(await req(`/api/apps/${appId}/publish`, { method: 'POST' }));
  const off = await json(await req(`/api/apps/${appId}/publish`, { method: 'POST' }));
  record('US-A08 AC3', 'publish then publish again returns to draft',
    on?.is_published === true && off?.is_published === false,
    `first=${on?.is_published} second=${off?.is_published}`);
  const { rows } = await pool.query('SELECT is_published FROM apps WHERE id = $1', [appId]);
  record('US-A08 AC3', 'the row agrees after the round trip',
    rows[0]?.is_published === false, `is_published=${rows[0]?.is_published}`);
}

// ── teardown ───────────────────────────────────────────────────────────────
{
  // Children before parents: `app_data_rows.created_by` references `users`, so
  // deleting the user first fails with 23503 and aborts the rest, leaving the
  // fixtures behind while still reporting success for what already ran.
  for (const id of cleanup.apps) await req(`/api/apps/${id}`, { method: 'DELETE' });

  // `activity_logs` does not cascade from `apps`, so the audit rows these
  // fixtures wrote have to go too, or the DB drifts one row per run.
  await pool.query(
    `DELETE FROM activity_logs WHERE entity_type = 'app'
       AND NOT EXISTS (SELECT 1 FROM apps a WHERE a.id = activity_logs.entity_id)`,
  );

  if (cleanup.users.length) {
    await pool.query('DELETE FROM app_data_rows WHERE created_by = ANY($1::text[])', [cleanup.users]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [cleanup.users]);
  }
  // Orgs last: `users.org_id` and `apps.org_id` both reference them.
  if (cleanup.orgs.length) {
    await pool.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [cleanup.orgs]);
  }

  // Prove the suite is idempotent, scoped to its own fixtures: a global count
  // would also see a sibling worktree's rows and read as a leak.
  const leftApps = await pool.query('SELECT COUNT(*)::int AS n FROM apps WHERE slug LIKE $1', [`${PREFIX}%`]);
  const leftUsers = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
  const leftOrgs = await pool.query('SELECT COUNT(*)::int AS n FROM organizations WHERE slug LIKE $1', [`${PREFIX}%`]);
  const leftRows = await pool.query(
    `SELECT COUNT(*)::int AS n FROM app_data_rows r
       WHERE NOT EXISTS (SELECT 1 FROM apps a WHERE a.id = r.app_id)`,
  );
  console.log(`  --   teardown: apps left=${leftApps.rows[0].n} users left=${leftUsers.rows[0].n} ` +
    `orgs left=${leftOrgs.rows[0].n} orphan data rows=${leftRows.rows[0].n}`);
  await pool.end();
}

const pass = results.filter((r) => r.pass).length;
console.log(`\n${pass}/${results.length} passed${pass === results.length ? '' : `, ${results.length - pass} FAILED`}`);
if (pass !== results.length) {
  console.log('\nfailures:');
  for (const r of results.filter((x) => !x.pass)) console.log(`  ${r.ac}  ${r.name}  (${r.detail})`);
}
process.exit(pass === results.length ? 0 : 1);
