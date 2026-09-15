#!/usr/bin/env node
/**
 * E2E for US-A01 — create a workspace (Rina).
 *
 * Plain node + fetch against a running dev server, plus one pg pool for the
 * assertions that have to read the database (AC4 is about what is NOT left
 * behind, which no response can prove).
 *
 * Every AC is asserted as its own kind:
 *   AC1 state      — read the workspace + role back through /api/auth/me and the DB
 *   AC2 failure    — drive a taken email, assert 409 and an unchanged org count
 *   AC3 state      — read the generated slug back out of the DB
 *   AC4 atomicity  — force the second statement to fail, count workspaces
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3001';
const results = [];
let cookies = '';

function record(ac, name, pass, detail = '') {
  results.push({ ac, name, pass, detail });
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${ac.padEnd(12)} ${name}${detail ? `  — ${detail}` : ''}`);
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(cookies ? { cookie: cookies } : {}) },
    redirect: 'manual',
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    if (pair.startsWith('po_session=')) cookies = pair;
  }
  return res;
}

const post = (path, body) =>
  req(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const json = async (r) => { try { return await r.json(); } catch { return null; } };

// ── db access (only for count/slug assertions) ------------------------------
const env = Object.fromEntries(
  readFileSync('../../.env', 'utf-8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const pool = new pg.Pool({ connectionString: env.PLATFORM_DATABASE_URL });
const one = async (text, params) => (await pool.query(text, params)).rows[0] ?? null;
const countWorkspaces = async () => Number((await one('SELECT COUNT(*)::int AS n FROM organizations')).n);

// Fixtures are tagged with a per-run suffix so a crashed earlier run can never
// make this one fail, and teardown can find every row this run created.
const tag = randomBytes(4).toString('hex');
const emailA = `e2e-a01-${tag}-rina@example.test`;
const emailB = `e2e-a01-${tag}-budi@example.test`;
const wsA = `E2E-A01 ${tag} Tim Marketing ANDALAN`;
const wsB = `  e2e a01   ${tag}   tim  marketing andalan  `;
const slugA = `e2e-a01-${tag}-tim-marketing-andalan`;

// ── US-A01 AC1: workspace created, Rina is admin in it ----------------------
{
  cookies = '';
  const before = await countWorkspaces();
  const r = await post('/api/auth/register', {
    workspace_name: wsA,
    name: 'Rina E2E',
    email: emailA,
    password: 'rinasecret123',
    confirm: 'rinasecret123',
  });
  const b = await json(r);
  record('US-A01 AC1', 'register creates the workspace', r.status === 201, `status=${r.status}`);

  const org = b?.workspace?.id ? await one('SELECT id, name, slug FROM organizations WHERE id = $1', [b.workspace.id]) : null;
  record('US-A01 AC1', 'workspace row exists with the given name', org?.name === wsA, `name=${org?.name ?? 'NONE'}`);

  // Read the role back instead of trusting the response body.
  const me = await json(await req('/api/auth/me'));
  record('US-A01 AC1', 'Rina is admin in that workspace (read back via /me)',
    me?.user?.role === 'admin' && me?.user?.org_id === b?.workspace?.id,
    `role=${me?.user?.role} org=${me?.user?.org_id === b?.workspace?.id ? 'same' : 'DIFFERENT'}`);

  const after = await countWorkspaces();
  record('US-A01 AC1', 'exactly one workspace was added', after === before + 1, `before=${before} after=${after}`);
}

// ── US-A01 AC3: slug derived from the name, unique across workspaces --------
{
  const slug = (await one('SELECT slug FROM organizations WHERE id = (SELECT org_id FROM users WHERE email = $1)', [emailA]))?.slug;
  record('US-A01 AC3', 'slug is derived from the workspace name', slug === slugA, `slug=${slug ?? 'NONE'} want=${slugA}`);
  record('US-A01 AC3', 'slug has no spaces or uppercase', !!slug && /^[a-z0-9-]+$/.test(slug), `slug=${slug ?? 'NONE'}`);
}

// ── US-A01 AC3: the same name slugifies to a DIFFERENT slug ---------------
{
  cookies = '';
  const r = await post('/api/auth/register', {
    workspace_name: wsB,
    name: 'Budi E2E',
    email: emailB,
    password: 'budisecret123',
    confirm: 'budisecret123',
  });
  const b = await json(r);
  record('US-A01 AC3', 'second workspace with an equivalent name is accepted', r.status === 201, `status=${r.status}`);
  const slug2 = b?.workspace?.slug;
  record('US-A01 AC3', 'slug is unique across workspaces', !!slug2 && slug2 !== slugA, `slug=${slug2 ?? 'NONE'}`);
}

// ── US-A01 AC2: a taken email is refused, no second workspace --------------
{
  cookies = '';
  const before = await countWorkspaces();
  const r = await post('/api/auth/register', {
    workspace_name: `E2E-A01 ${tag} Duplicate Attempt`,
    name: 'Rina Again',
    email: emailA,
    password: 'rinasecret123',
    confirm: 'rinasecret123',
  });
  const b = await json(r);
  record('US-A01 AC2', 'duplicate email refused with a clear message',
    r.status === 409 && typeof b?.message === 'string' && b.message.length > 0,
    `status=${r.status} message=${b?.message ?? 'NONE'}`);
  const after = await countWorkspaces();
  record('US-A01 AC2', 'no second workspace was created', after === before, `before=${before} after=${after}`);
}

// ── US-A01 AC4: a failure mid-registration leaves nothing behind -----------
// Five concurrent registrations share one email. Exactly one may win; the other
// four must fail and roll their workspace back. Without a transaction each
// loser leaves an ownerless organization, which this asserts against directly.
{
  const raceEmail = `e2e-a01-${tag}-race@example.test`;
  const before = await countWorkspaces();
  const attempts = await Promise.all(
    Array.from({ length: 5 }, () =>
      post('/api/auth/register', {
        workspace_name: `E2E-A01 ${tag} Race`,
        name: 'Race E2E',
        email: raceEmail,
        password: 'racesecret123',
        confirm: 'racesecret123',
      }).then(async (r) => ({ status: r.status, body: await json(r) })),
    ),
  );
  const won = attempts.filter((a) => a.status === 201).length;
  const refused = attempts.filter((a) => a.status === 409).length;
  record('US-A01 AC4', 'exactly one concurrent registration wins', won === 1, `created=${won} of 5`);
  record('US-A01 AC4', 'the losers are refused, not 500', refused === 4, `409=${refused} others=${attempts.map((a) => a.status).filter((s) => s !== 201 && s !== 409).join(',') || 'none'}`);

  const after = await countWorkspaces();
  record('US-A01 AC4', 'failed attempts left no workspace behind', after === before + 1, `before=${before} after=${after}`);

  // The direct statement of AC4: nothing half-made survives anywhere.
  const orphan = await one(
    `SELECT COUNT(*)::int AS n FROM organizations o
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.org_id = o.id)`,
  );
  record('US-A01 AC4', 'no ownerless workspace exists in the database', Number(orphan.n) === 0, `orphan_workspaces=${orphan.n}`);
}

// ── US-A01 AC1 + AC3 under contention: a burst of the SAME name ------------
// Eight registrations share one workspace name. Every one must get its own
// workspace: a slug lookup that loses the race must fall back, not surface as a
// 500. Asserting the status codes alone is not enough — the slugs have to be
// distinct, or AC3 is violated while every request returns 201.
{
  const before = await countWorkspaces();
  const burst = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      post('/api/auth/register', {
        workspace_name: `E2E-A01 ${tag} Tim Marketing ANDALAN`,
        name: `Burst ${i} E2E`,
        email: `e2e-a01-${tag}-burst-${i}@example.test`,
        password: 'burstsecret123',
        confirm: 'burstsecret123',
      }).then(async (r) => ({ status: r.status, body: await json(r) })),
    ),
  );
  const created = burst.filter((b) => b.status === 201);
  const fivexx = burst.filter((b) => b.status >= 500);
  record('US-A01 AC1', 'a burst of identical names creates every workspace (no 500)',
    created.length === 8 && fivexx.length === 0,
    `201=${created.length}/8 5xx=${fivexx.length}`);
  const slugs = created.map((b) => b.body?.workspace?.slug).filter(Boolean);
  record('US-A01 AC3', 'contending slugs are all distinct',
    slugs.length === 8 && new Set(slugs).size === 8,
    `unique=${new Set(slugs).size}/${slugs.length}`);
  record('US-A01 AC3', 'every contending slug still derives from the name',
    slugs.length === 8 && slugs.every((s) => s.startsWith(`e2e-a01-${tag}-tim-marketing-andalan`)),
    `sample=${slugs[0] ?? 'NONE'}`);
  const after = await countWorkspaces();
  record('US-A01 AC1', 'the burst added exactly eight workspaces', after === before + 8, `before=${before} after=${after}`);
}

// ── teardown: children before parents, then prove the count came back -------
{
  const emails = [
    emailA,
    emailB,
    `e2e-a01-${tag}-race@example.test`,
    ...Array.from({ length: 8 }, (_, i) => `e2e-a01-${tag}-burst-${i}@example.test`),
  ];
  const delUsers = await pool.query(`DELETE FROM users WHERE email = ANY($1::text[]) RETURNING id`, [emails]);
  const delOrgs = await pool.query(`DELETE FROM organizations WHERE slug LIKE $1 RETURNING id`, [`e2e-a01-${tag}%`]);
  console.log(`  --   teardown: removed ${delUsers.rowCount} user(s), ${delOrgs.rowCount} workspace(s)`);

  const leftovers = await one(
    `SELECT COUNT(*)::int AS n FROM organizations WHERE slug LIKE 'e2e-a01-%'`,
  );
  record('US-A01 AC4', 'teardown left no fixture row', Number(leftovers.n) === 0, `remaining=${leftovers.n}`);
}

await pool.end();
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.some((r) => !r.pass) ? 1 : 0);

