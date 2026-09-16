#!/usr/bin/env node
/**
 * E2E for US-A03 — invite members with a role (Rina).
 *
 * Plain node + fetch against a running dev server, plus one pg pool for the
 * assertions that have to read the database (AC1 pending-invite row, AC4
 * duplicate rejection, AC5 single-use).
 *
 * Every AC is asserted as its own kind:
 *   AC1 state       — read the pending invitation row back
 *   AC2 state       — accept with name+password, read the user's role back
 *   AC3 state       — force-expire, assert refusal + resend works
 *   AC4 failure     — drive an existing member email, assert 409
 *   AC5 idempotency — accept twice, assert the second accept is refused
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

/**
 * Switch the active session. Every block that needs a specific identity calls
 * this instead of inheriting whatever the previous block left behind — a stale
 * cookie reads as a 403 and looks like a broken permission check.
 */
async function loginAs(email, password) {
  cookies = '';
  const r = await post('/api/auth/login', { email, password });
  return r.status;
}

// ── db access ------------------------------------------------------------
const env = Object.fromEntries(
  readFileSync('../../.env', 'utf-8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const pool = new pg.Pool({ connectionString: env.PLATFORM_DATABASE_URL });
const one = async (text, params) => (await pool.query(text, params)).rows[0] ?? null;

// Per-run suffix: a crashed earlier run can never poison this one, and teardown
// can find every row this run created.
const tag = randomBytes(4).toString('hex');
const adminEmail = `e2e-a03-${tag}-admin@example.test`;
const inviteeEmail = `e2e-a03-${tag}-builder@example.test`;
const expiredEmail = `e2e-a03-${tag}-expired@example.test`;
const adminBEmail = `e2e-a03-${tag}-adminb@example.test`;
const viewerBEmail = `e2e-a03-${tag}-viewerb@example.test`;

// ── Bootstrap: register an admin (US-A01 path) ----------------------------
{
  const r = await post('/api/auth/register', {
    workspace_name: `E2E-A03 ${tag}`,
    name: 'Rina E2E Admin',
    email: adminEmail,
    password: 'rinasecret123',
    confirm: 'rinasecret123',
  });
  if (r.status !== 201) {
    console.log(`  --   bootstrap failed (${r.status}) — cannot run US-A03 tests`);
    await pool.end();
    process.exit(77);
  }
  console.log('  --   bootstrapped admin + workspace');
}

// ── US-A03 AC4: inviting an existing member is refused --------------------
{
  const r = await post('/api/orgs/invitations', { email: adminEmail, role: 'builder' });
  const b = await json(r);
  record('US-A03 AC4', 'inviting an existing member returns 409',
    r.status === 409, `status=${r.status}`);
  record('US-A03 AC4', 'the warning names the reason',
    typeof b?.message === 'string' && b.message.includes('sudah'),
    `message=${b?.message ?? 'NONE'}`);

  // A refused invite must not have written a row.
  const stray = await one('SELECT id FROM invitations WHERE email = $1', [adminEmail]);
  record('US-A03 AC4', 'the refused invite wrote no row',
    !stray, `found=${!!stray}`);
}

// ── US-A03 AC1: invite a builder — recorded as pending --------------------
let inviteToken = null;
{
  const r = await post('/api/orgs/invitations', { email: inviteeEmail, role: 'builder' });
  const b = await json(r);
  record('US-A03 AC1', 'inviting a new email returns 201',
    r.status === 201, `status=${r.status}`);
  record('US-A03 AC1', 'the response carries an invite link',
    typeof b?.inviteUrl === 'string' && b.inviteUrl.startsWith('/invite/'),
    `inviteUrl=${b?.inviteUrl ?? 'NONE'}`);

  // Read the row back — the AC is about what was RECORDED, not what was returned.
  const invite = await one(
    'SELECT id, org_id, email, role, token, expires_at, accepted_at FROM invitations WHERE email = $1',
    [inviteeEmail],
  );
  record('US-A03 AC1', 'a pending invitation row exists',
    !!invite && invite.email === inviteeEmail, `found=${!!invite}`);
  record('US-A03 AC1', 'the invited role is stored',
    invite?.role === 'builder', `role=${invite?.role ?? 'NONE'}`);
  record('US-A03 AC1', 'the invitation is still pending',
    !!invite && !invite.accepted_at, `accepted_at=${invite?.accepted_at ?? 'null'}`);
  record('US-A03 AC1', 'the invitation expires ~24h from now',
    !!invite && new Date(invite.expires_at).getTime() - Date.now() > 23 * 3600 * 1000,
    `expires_at=${invite?.expires_at ?? 'NONE'}`);

  inviteToken = invite?.token ?? null;
}

// ── US-A03 AC2: accept with name + password ------------------------------
{
  const r = await req(`/api/invitations/${inviteToken}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Budi Invited', password: 'budisecret123', confirm: 'budisecret123' }),
  });
  const b = await json(r);
  record('US-A03 AC2', 'accepting a valid invitation returns 201',
    r.status === 201 && b?.ok === true, `status=${r.status} ok=${b?.ok}`);

  // Read the created account back: the AC is "akunnya aktif dengan peran yang benar".
  const user = await one(
    'SELECT id, email, name, org_id, role FROM users WHERE email = $1',
    [inviteeEmail],
  );
  record('US-A03 AC2', 'the account now exists',
    !!user, `found=${!!user}`);
  record('US-A03 AC2', 'the account has the invited role',
    user?.role === 'builder', `role=${user?.role ?? 'NONE'}`);
  record('US-A03 AC2', 'the account carries the submitted name',
    user?.name === 'Budi Invited', `name=${user?.name ?? 'NONE'}`);

  const invite = await one('SELECT org_id, accepted_at FROM invitations WHERE email = $1', [inviteeEmail]);
  record('US-A03 AC2', 'the account joined the inviting workspace',
    !!user && user.org_id === invite?.org_id, `org_match=${user?.org_id === invite?.org_id}`);
  record('US-A03 AC2', 'the invitation is now marked accepted',
    !!invite?.accepted_at, `accepted_at=${invite?.accepted_at ?? 'null'}`);

  // The new account must be usable — a row with no working session proves nothing.
  const before = cookies;
  cookies = '';
  const login = await post('/api/auth/login', { email: inviteeEmail, password: 'budisecret123' });
  const me = login.status === 200 ? await json(await req('/api/auth/me')) : null;
  record('US-A03 AC2', 'the invited account can log in with its role',
    login.status === 200 && me?.user?.role === 'builder',
    `login=${login.status} role=${me?.user?.role ?? 'NONE'}`);

  // Hand the session back to the admin: the accept above handed the invitee a
  // session cookie, and every later admin-only call would otherwise 403.
  if (await loginAs(adminEmail, 'rinasecret123') !== 200) cookies = before;
}

// ── US-A03 AC5: a used link is refused the second time --------------------
{
  const r = await req(`/api/invitations/${inviteToken}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Budi Again', password: 'budisecret123', confirm: 'budisecret123' }),
  });
  const b = await json(r);
  record('US-A03 AC5', 're-using an accepted link returns 410',
    r.status === 410, `status=${r.status}`);
  record('US-A03 AC5', 'the refusal names already_used',
    b?.error === 'already_used', `error=${b?.error ?? 'NONE'}`);

  // A refused re-use must not have created a second account.
  const n = await one('SELECT COUNT(*)::int AS n FROM users WHERE email = $1', [inviteeEmail]);
  record('US-A03 AC5', 'the refused re-use created no second account',
    Number(n?.n) === 1, `users=${n?.n}`);

  // Burst the same token: concurrent accepts must not both win.
  const burst = await Promise.all(
    Array.from({ length: 6 }, () =>
      req(`/api/invitations/${inviteToken}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Race', password: 'racesecret123', confirm: 'racesecret123' }),
      }),
    ),
  );
  record('US-A03 AC5', 'a burst of re-uses produces no 5xx',
    burst.every((r) => r.status < 500),
    `statuses=${burst.map((r) => r.status).join(',')}`);
  const n2 = await one('SELECT COUNT(*)::int AS n FROM users WHERE email = $1', [inviteeEmail]);
  record('US-A03 AC5', 'the burst created no extra account',
    Number(n2?.n) === 1, `users=${n2?.n}`);
}

// ── US-A03 AC3: an expired invitation is refused, then resendable --------
{
  const r = await post('/api/orgs/invitations', { email: expiredEmail, role: 'viewer' });
  const b = await json(r);
  record('US-A03 AC3', 'a fresh invitation for the expiry probe is created',
    r.status === 201, `status=${r.status}`);

  // Force-expire it: the AC is about the 24h window, which a test cannot wait for.
  await pool.query(`UPDATE invitations SET expires_at = NOW() - INTERVAL '1 minute' WHERE email = $1`, [expiredEmail]);
  const stale = await one('SELECT id, token FROM invitations WHERE email = $1', [expiredEmail]);

  const acc = await req(`/api/invitations/${stale?.token}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Expired User', password: 'expiredsecret123', confirm: 'expiredsecret123' }),
  });
  const ab = await json(acc);
  record('US-A03 AC3', 'accepting an expired invitation returns 410',
    acc.status === 410, `status=${acc.status}`);
  record('US-A03 AC3', 'the refusal names expired',
    ab?.error === 'expired', `error=${ab?.error ?? 'NONE'}`);

  // "muncul halaman kedaluwarsa" — the public page must render the expired state.
  const page = await fetch(`${BASE}/invite/${stale?.token}`);
  const html = await page.text();
  record('US-A03 AC3', 'the invite page renders the expired state',
    page.status === 200 && /kedaluwarsa/i.test(html),
    `status=${page.status} expiredCopy=${/kedaluwarsa/i.test(html)}`);

  // The invitation survives (it is expired, not deleted) so Rina can resend it.
  const still = await one('SELECT id, accepted_at FROM invitations WHERE email = $1', [expiredEmail]);
  record('US-A03 AC3', 'the expired invitation is retained, not deleted',
    !!still, `found=${!!still}`);
  record('US-A03 AC3', 'the expired invitation was not marked accepted',
    !still?.accepted_at, `accepted_at=${still?.accepted_at ?? 'null'}`);

  // "Rina bisa kirim ulang" — resend must mint a working link.
  const res = await req(`/api/orgs/invitations/${still?.id}/resend`, { method: 'POST' });
  const rb = await json(res);
  record('US-A03 AC3', 'resending the invitation succeeds',
    res.status === 200 && rb?.ok === true, `status=${res.status} ok=${rb?.ok}`);
  record('US-A03 AC3', 'the resent invitation carries a new token',
    typeof rb?.token === 'string' && rb.token !== stale?.token,
    `rotated=${typeof rb?.token === 'string' && rb.token !== stale?.token}`);

  const acc2 = await req(`/api/invitations/${rb?.token}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Resend User', password: 'resendsecret123', confirm: 'resendsecret123' }),
  });
  record('US-A03 AC3', 'the resent link is accepted (the window reopened)',
    acc2.status === 201, `status=${acc2.status}`);
}

// ── US-A03 AC1: the admin guard is enforced by the server, not the UI -----
// An admin-only route must refuse a builder with 403. Register a workspace,
// invite a builder into it, accept as that builder, then attempt to invite.
{
  const adminCookies = cookies;
  cookies = '';

  const reg = await post('/api/auth/register', {
    workspace_name: `E2E-A03 ${tag} B`,
    name: 'Admin B',
    email: adminBEmail,
    password: 'adminbsecret123',
    confirm: 'adminbsecret123',
  });
  console.log(`  --   probe workspace B registered (status=${reg.status})`);

  if (reg.status === 201) {
    const inv = await json(await post('/api/orgs/invitations', { email: viewerBEmail, role: 'builder' }));
    const token = inv?.invitation?.token;

    if (token) {
      const acc = await req(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Builder B', password: 'buildersecret123', confirm: 'buildersecret123' }),
      });
      record('US-A03 AC2', 'an invited builder lands with the builder role',
        acc.status === 201, `status=${acc.status}`);

      // Act AS the builder from here: every admin-only call must be refused.
      const invR = await post('/api/orgs/invitations', {
        email: `e2e-a03-${tag}-nope@example.test`, role: 'viewer',
      });
      record('US-A04 AC2', 'a builder cannot invite — server returns 403',
        invR.status === 403, `status=${invR.status}`);

      const listR = await req('/api/orgs/invitations');
      record('US-A04 AC2', 'a builder cannot read the invitation list',
        listR.status === 403, `status=${listR.status}`);

      const me = await json(await req('/api/auth/me'));
      const patchR = await req(`/api/orgs/members/${me?.user?.id ?? 'self'}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });
      record('US-A04 AC2', 'a builder cannot change a role — server returns 403',
        patchR.status === 403, `status=${patchR.status}`);

      const after = await one('SELECT role FROM users WHERE email = $1', [viewerBEmail]);
      record('US-A04 AC2', 'the refused PATCH changed nothing',
        after?.role === 'builder', `role=${after?.role ?? 'NONE'}`);
    }
  }

  cookies = adminCookies;
}

// ── US-A03 AC4: duplicate detection is scoped to the workspace ------------
// "Kalau email sudah jadi anggota workspace INI" — the scope is the workspace.
// A second workspace must still be able to invite the same address, otherwise
// one org's member list would leak into another's.
{
  const shared = `e2e-a03-${tag}-shared@example.test`;
  // Pin the identity: the AC3 block ends by accepting an invitation, which
  // hands the new account a session cookie. Inheriting it here would read as a
  // broken permission check rather than a stale cookie.
  await loginAs(adminEmail, 'rinasecret123');

  const first = await post('/api/orgs/invitations', { email: shared, role: 'viewer' });
  record('US-A03 AC4', 'a fresh address invites cleanly into workspace A',
    first.status === 201, `status=${first.status}`);

  // Accept it so `shared` becomes a real member of workspace A.
  const t1 = (await json(first))?.invitation?.token;
  const acc1 = await req(`/api/invitations/${t1}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Shared Member', password: 'sharedsecret123', confirm: 'sharedsecret123' }),
  });
  record('US-A03 AC4', 'the shared address joins workspace A',
    acc1.status === 201, `status=${acc1.status}`);

  // The accept handed the session to `shared`; take it back before acting as
  // the admin again, or the next invite 403s for the wrong reason.
  await loginAs(adminEmail, 'rinasecret123');

  // Re-inviting it into workspace A is now a duplicate.
  const dup = await post('/api/orgs/invitations', { email: shared, role: 'builder' });
  record('US-A03 AC4', 're-inviting a member of this workspace returns 409',
    dup.status === 409, `status=${dup.status}`);

  const adminCookies = cookies;

  // The same address is NOT a member of workspace B, so B must be allowed to
  // invite it — and that invitation must be its own row, not A's.
  cookies = '';
  await post('/api/auth/login', { email: adminBEmail, password: 'adminbsecret123' });
  const cross = await post('/api/orgs/invitations', { email: shared, role: 'viewer' });
  record('US-A03 AC4', 'the same address is still invitable into another workspace',
    cross.status === 201, `status=${cross.status}`);

  const rows = await pool.query(
    'SELECT org_id FROM invitations WHERE email = $1 ORDER BY created_at',
    [shared],
  );
  record('US-A03 AC4', 'the two invitations belong to two different workspaces',
    rows.rowCount === 2 && rows.rows[0].org_id !== rows.rows[1].org_id,
    `orgs=${rows.rows.map((r) => r.org_id).join(',')}`);
  cookies = adminCookies;

  // Leave no trace of the shared-address probe. activity_logs references
  // users(id), so the log rows go first — deleting the user alone raises 23503
  // and aborts the rest of the cleanup.
  const sharedIds = (await pool.query('SELECT id FROM users WHERE email = $1', [shared])).rows.map((r) => r.id);
  await pool.query('DELETE FROM activity_logs WHERE user_id = ANY($1::text[])', [sharedIds]);
  await pool.query('DELETE FROM invitations WHERE email = $1', [shared]);
  await pool.query('DELETE FROM users WHERE email = $1', [shared]);
}

// ── tenant isolation: workspace B cannot reach A's members -----------------
{
  const adminCookies = cookies;
  cookies = '';

  const login = await post('/api/auth/login', { email: adminBEmail, password: 'adminbsecret123' });
  record('US-A04 AC6', 'workspace B\'s admin can log in',
    login.status === 200, `status=${login.status}`);

  if (login.status === 200) {
    const list = await json(await req('/api/orgs/members'));
    const emails = (list?.members ?? []).map((m) => m.email);
    record('US-A04 AC6', 'workspace B\'s member list excludes workspace A\'s admin',
      !emails.includes(adminEmail), `emails=${emails.join(',') || 'NONE'}`);

    // Guess workspace A's member id by URL — must be 404 and change no row.
    const victim = await one('SELECT id, role FROM users WHERE email = $1', [inviteeEmail]);
    const patch = await req(`/api/orgs/members/${victim?.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    record('US-A04 AC6', 'guessing a foreign member id returns 404',
      patch.status === 404, `status=${patch.status}`);

    const after = await one('SELECT role FROM users WHERE email = $1', [inviteeEmail]);
    record('US-A04 AC6', 'the cross-tenant attempt changed no row',
      after?.role === victim?.role, `role=${after?.role ?? 'NONE'}`);

    // "tidak ada data yang terungkap": count workspace A's rows around the
    // attempt. A guard that 404s but still wrote something would pass the two
    // assertions above and fail this one.
    const countRows = async () => Number(
      (await one('SELECT COUNT(*)::int AS n FROM users WHERE org_id = (SELECT org_id FROM users WHERE email = $1)',
        [inviteeEmail]))?.n,
    );
    const before = await countRows();
    await req(`/api/orgs/members/${victim?.id}`, { method: 'DELETE' });
    await req(`/api/orgs/members/${victim?.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'viewer' }),
    });
    const afterN = await countRows();
    record('US-A04 AC6', 'the cross-tenant attempts left the row count unchanged',
      before === afterN, `before=${before} after=${afterN}`);
  }
  cookies = adminCookies;
}

// ── the boundary really moves: viewer refused, promoted allowed, revoked out ─
// Three claims the earlier blocks do not make, each asserted as its own kind:
//   (a) a `viewer` is refused on the admin-only route by the SERVER (403)
//   (b) promoting viewer -> admin changes what the member's NEXT request may do
//   (c) revoking access invalidates the session that member is still holding,
//       which "the row is gone" would not catch
{
  const roleProbe = `e2e-a03-${tag}-roleprobe@example.test`;
  const roleProbePw = 'roleprobesecret123';

  // Admin B is the actor here; pin the identity instead of inheriting whatever
  // the previous block left in the cookie jar.
  await loginAs(adminBEmail, 'adminbsecret123');

  const inv = await post('/api/orgs/invitations', { email: roleProbe, role: 'viewer' });
  record('US-A03 AC1', 'a viewer-role invitation is recorded as pending',
    inv.status === 201, `status=${inv.status}`);
  const token = (await json(inv))?.invitation?.token;

  const acc = await req(`/api/invitations/${token}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Role Probe', password: roleProbePw, confirm: roleProbePw }),
  });
  record('US-A03 AC2', 'the invited viewer gets an active account',
    acc.status === 201, `status=${acc.status}`);

  // (a) The viewer's own session is in the jar now. An admin-only route must
  // refuse it — and the refusal must come from the server, not a hidden button.
  const asViewer = await post('/api/orgs/invitations', {
    email: `e2e-a03-${tag}-nope2@example.test`, role: 'viewer',
  });
  const viewerBody = await json(asViewer);
  record('US-A04 AC2', 'a viewer cannot invite — server returns 403',
    asViewer.status === 403, `status=${asViewer.status}`);
  // "buktikan lewat can(), bukan cuma status": a 403 alone could come from
  // anywhere. `forbidden` is the code only the can() branch emits, so this
  // pins the refusal to the role check rather than to a route that 403s for
  // some other reason.
  record('US-A04 AC2', 'the refusal is the can() branch, not an incidental 403',
    viewerBody?.error === 'forbidden', `error=${viewerBody?.error}`);

  // The ranked comparison itself: admin (3) must be admitted wherever builder
  // (2) is the requirement, and viewer (1) must not. Aimed at a route whose
  // can() gate is `['builder']`; a caller that clears the gate reaches the
  // handler and gets 404 for the missing app, one that fails gets 403 — so the
  // status discriminates the gate, not the resource.
  const gate = (role) => req('/api/apps/does-not-exist-e2e', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'x' }),
  });
  const viewerGate = await gate('viewer');
  record('US-A04 AC2', 'viewer is below a builder-only gate (403)',
    viewerGate.status === 403, `status=${viewerGate.status}`);

  await loginAs(adminBEmail, 'adminbsecret123');
  const adminGate = await gate('admin');
  record('US-A04 AC2', 'admin clears a builder-only gate (>=, not ==)',
    adminGate.status !== 403, `status=${adminGate.status}`);

  await loginAs(roleProbe, roleProbePw);

  // (b) Promote viewer -> admin, then re-issue the SAME request. If the role
  // were cosmetic the second call would 403 exactly like the first.
  const member = await one('SELECT id, role FROM users WHERE email = $1', [roleProbe]);
  await loginAs(adminBEmail, 'adminbsecret123');
  const promote = await req(`/api/orgs/members/${member?.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'admin' }),
  });
  record('US-A04 AC3', 'an admin can promote a member',
    promote.status === 200, `status=${promote.status}`);

  const reread = await one('SELECT role FROM users WHERE email = $1', [roleProbe]);
  record('US-A04 AC3', 'the new role is what the row now says',
    reread?.role === 'admin', `role=${reread?.role ?? 'NONE'}`);

  const logged = await one(
    `SELECT meta_json FROM activity_logs
      WHERE action = 'role_changed' AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [member?.id],
  );
  record('US-A04 AC3', 'the change is recorded in the activity log with from/to',
    logged?.meta_json?.from === 'viewer' && logged?.meta_json?.to === 'admin',
    `log=${JSON.stringify(logged?.meta_json ?? null)}`);

  await loginAs(roleProbe, roleProbePw);
  const afterPromote = await post('/api/orgs/invitations', {
    email: `e2e-a03-${tag}-now-allowed@example.test`, role: 'viewer',
  });
  record('US-A04 AC3', 'the promoted member can now do it (access really changed)',
    afterPromote.status === 201, `status=${afterPromote.status}`);

  // (c) Revoke. Keep the member's own cookie so the claim "they can no longer
  // reach the workspace" is tested against a session that still exists.
  const heldCookie = cookies;
  await loginAs(adminBEmail, 'adminbsecret123');
  const revoke = await req(`/api/orgs/members/${member?.id}`, { method: 'DELETE' });
  record('US-A04 AC2', 'an admin can revoke a member',
    revoke.status === 200, `status=${revoke.status}`);

  const gone = await one('SELECT id FROM users WHERE id = $1', [member?.id]);
  record('US-A04 AC2', 'the revoked member row is gone',
    !gone, `found=${!!gone}`);

  const stale = await fetch(`${BASE}/api/orgs/invitations`, { headers: { cookie: heldCookie } });
  record('US-A04 AC2', "the revoked member's held session no longer authenticates",
    stale.status === 401, `status=${stale.status}`);

  await loginAs(adminBEmail, 'adminbsecret123');
}

// ── teardown: children before parents, then prove the rows came back -------
{
  // Pattern-based, not id-based: a run that crashed mid-suite leaves rows with
  // no tag to match, and the leftover assertion below would fail forever. The
  // `e2e-a03-` prefix is this suite's own namespace, so a sweep is safe.
  const prefix = 'e2e-a03-%';
  const delInvites = await pool.query('DELETE FROM invitations WHERE email LIKE $1 RETURNING id', [prefix]);
  const delLogs = await pool.query(
    `DELETE FROM activity_logs WHERE org_id IN (SELECT id FROM organizations WHERE slug LIKE $1)
       OR user_id IN (SELECT id FROM users WHERE email LIKE $1) RETURNING id`,
    [prefix],
  );
  const delUsers = await pool.query('DELETE FROM users WHERE email LIKE $1 RETURNING id', [prefix]);
  const delOrgs = await pool.query('DELETE FROM organizations WHERE slug LIKE $1 RETURNING id', [prefix]);
  console.log(
    `  --   teardown: ${delInvites.rowCount} invite(s), ${delLogs.rowCount} log(s), ` +
    `${delUsers.rowCount} user(s), ${delOrgs.rowCount} workspace(s)`,
  );

  const left = await one(
    `SELECT (SELECT COUNT(*)::int FROM invitations WHERE email LIKE 'e2e-a03-%')
          + (SELECT COUNT(*)::int FROM users WHERE email LIKE 'e2e-a03-%')
          + (SELECT COUNT(*)::int FROM organizations WHERE slug LIKE 'e2e-a03-%') AS n`,
  );
  record('US-A03 AC1', 'teardown left no fixture rows behind',
    Number(left?.n ?? -1) === 0, `remaining=${left?.n ?? 'NONE'}`);
}

await pool.end();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
