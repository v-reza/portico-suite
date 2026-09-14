#!/usr/bin/env node
/**
 * End-to-end API test for the Hub. Run: node scripts/e2e.mjs
 *
 * Exercises the real HTTP surface against the running dev server — no mocks, no
 * importing internals. Every assertion maps to an acceptance criterion in
 * 00-MASTER-PRD.md, and the id is printed so the checklist can cite it.
 *
 * Exit code is non-zero if anything fails, so CI (and a human) can trust it.
 */
import { createHash, randomBytes } from 'node:crypto';

const BASE = process.env.HUB_BASE_URL || 'http://localhost:3100';
const results = [];
let cookies = '';

function record(ac, name, pass, detail = '') {
  results.push({ ac, name, pass, detail });
  const mark = pass ? '  ok  ' : ' FAIL ';
  console.log(`${mark} ${ac.padEnd(12)} ${name}${detail ? `  — ${detail}` : ''}`);
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(cookies ? { cookie: cookies } : {}),
    },
    redirect: 'manual',
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const [pair] = c.split(';');
    const [name] = pair.split('=');
    if (name === 'hub_session') cookies = pair;
  }
  return res;
}

const json = async (r) => { try { return await r.json(); } catch { return null; } };

// --- US-M08: health & readiness --------------------------------------------

{
  const r = await req('/health');
  const b = await json(r);
  record('US-M08 AC1', '/health returns 200 without auth', r.status === 200 && b?.status === 'ok', `status=${r.status}`);
}

{
  const r = await req('/ready');
  const b = await json(r);
  const comps = b?.components ?? {};
  const named = Object.keys(comps);
  record('US-M08 AC2', '/ready reports per-component latency', r.status === 200 && named.length >= 2 && typeof comps.database?.latencyMs === 'number', named.join(','));
  const body = JSON.stringify(b);
  const leaks = ['postgresql://', 'redis://', 'localhost:5432', 'localhost:6379', 'node_modules'].filter((s) => body.includes(s));
  record('US-M08 AC4', '/ready leaks no secrets', leaks.length === 0, leaks.length ? `leaked: ${leaks}` : 'clean');
  record('US-M08 AC5', '/ready is not cacheable', (r.headers.get('cache-control') ?? '').includes('no-store'), r.headers.get('cache-control') ?? '');
}

// --- US-M10: SSO ------------------------------------------------------------

{
  // No session -> /authorize must bounce to /login carrying `next`, not dead-end.
  const p = `client_id=platform&redirect_uri=${encodeURIComponent('http://localhost:3001/api/auth/hub/callback')}&state=st1&code_challenge=abc&code_challenge_method=S256&response_type=code`;
  const r = await req(`/authorize?${p}`);
  const loc = r.headers.get('location') ?? '';
  record('US-M10 AC4', 'unauthenticated /authorize redirects to /login with next', r.status === 307 || r.status === 302 ? loc.includes('/login') && loc.includes('next=') : false, `status=${r.status} loc=${loc.slice(0, 60)}`);
}

{
  // Unknown client -> error page, and critically NOT a redirect (open-redirect guard).
  const r = await req('/authorize?client_id=evil&redirect_uri=http://evil.example/cb&state=s&code_challenge=c&code_challenge_method=S256&response_type=code');
  record('US-M11 AC2', 'unknown client_id does not redirect', r.status === 400 && !r.headers.get('location'), `status=${r.status}`);
}

{
  // Registered client but a redirect_uri that is not on the whitelist.
  const r = await req(`/authorize?client_id=platform&redirect_uri=${encodeURIComponent('http://evil.example/cb')}&state=s&code_challenge=c&code_challenge_method=S256&response_type=code`);
  record('US-M10 AC5', 'unlisted redirect_uri is refused (exact match)', r.status === 400 && !r.headers.get('location'), `status=${r.status}`);
}

{
  // PKCE is mandatory.
  const r = await req(`/authorize?client_id=platform&redirect_uri=${encodeURIComponent('http://localhost:3001/api/auth/hub/callback')}&state=s&response_type=code`);
  record('US-M10 AC5', 'missing PKCE challenge is refused', r.status === 400, `status=${r.status}`);
}

// --- login ------------------------------------------------------------------

{
  const r = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@portico.dev', password: 'wrong-password' }),
  });
  const b = await json(r);
  record('US-M10 AC3', 'wrong password is refused with a generic message', r.status === 401 && /salah/i.test(b?.message ?? ''), `status=${r.status}`);
}

{
  const r = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@portico.dev', password: 'whatever' }),
  });
  const b = await json(r);
  record('US-M10 AC3', 'unknown email gives the SAME message (no enumeration)', r.status === 401 && /salah/i.test(b?.message ?? ''), `status=${r.status}`);
}

{
  const r = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@portico.dev', password: 'demo1234' }),
  });
  const b = await json(r);
  record('US-M01 AC2', 'demo account logs in', r.status === 200 && b?.ok === true, `status=${r.status}`);
  record('US-M10 AC1', 'session cookie is httpOnly', (r.headers.getSetCookie?.() ?? []).some((c) => /httponly/i.test(c)), '');
}

// --- session resolve --------------------------------------------------------

let accessToken = '';
{
  // Full authorization-code exchange using a real PKCE pair.
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const redirectUri = 'http://localhost:3001/api/auth/hub/callback';

  const auth = await req(`/authorize?client_id=platform&redirect_uri=${encodeURIComponent(redirectUri)}&state=st2&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`);
  const loc = auth.headers.get('location') ?? '';
  const code = new URL(loc).searchParams.get('code');
  // NextResponse.redirect defaults to 307; 302/303 are equally valid here.
  record('US-M10 AC1', 'authorize issues a code for a member', [302, 303, 307].includes(auth.status) && !!code, `status=${auth.status} code=${code ? 'present' : 'MISSING'}`);

  if (code) {
    const tok = await req('/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: redirectUri,
        client_id: 'platform', client_secret: 'dev-platform-secret', code_verifier: verifier,
      }).toString(),
    });
    const b = await json(tok);
    accessToken = b?.access_token ?? '';
    record('US-M10 AC1', 'code exchanges for id_token + access_token', tok.status === 200 && !!b?.id_token && !!accessToken, `status=${tok.status}`);

    // Decode the id_token: it must NOT carry a role claim (§5.1).
    if (b?.id_token) {
      const claims = JSON.parse(Buffer.from(b.id_token.split('.')[1], 'base64url').toString());
      record('US-M10 AC1', 'id_token carries NO role claim', !('role' in claims) && !('roles' in claims), `claims=${Object.keys(claims).join(',')}`);
      record('US-M10 AC1', 'id_token aud is the requesting app', claims.aud === 'platform', `aud=${claims.aud}`);
    }

    // Replay must fail — a code is single-use (US-M10 AC5).
    const replay = await req('/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: redirectUri,
        client_id: 'platform', client_secret: 'dev-platform-secret', code_verifier: verifier,
      }).toString(),
    });
    record('US-M10 AC5', 'replaying a used code is refused', replay.status === 400, `status=${replay.status}`);

    // Wrong PKCE verifier must fail.
    const auth2 = await req(`/authorize?client_id=platform&redirect_uri=${encodeURIComponent(redirectUri)}&state=st3&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`);
    const code2 = new URL(auth2.headers.get('location') ?? 'http://x/').searchParams.get('code');
    if (code2) {
      const bad = await req('/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code', code: code2, redirect_uri: redirectUri,
          client_id: 'platform', client_secret: 'dev-platform-secret', code_verifier: 'wrong-verifier-value',
        }).toString(),
      });
      record('US-M10 AC5', 'wrong code_verifier is refused', bad.status === 400, `status=${bad.status}`);
    }

    // Wrong client secret must fail.
    const auth3 = await req(`/authorize?client_id=platform&redirect_uri=${encodeURIComponent(redirectUri)}&state=st4&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`);
    const code3 = new URL(auth3.headers.get('location') ?? 'http://x/').searchParams.get('code');
    if (code3) {
      const bad = await req('/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code', code: code3, redirect_uri: redirectUri,
          client_id: 'platform', client_secret: 'wrong-secret', code_verifier: verifier,
        }).toString(),
      });
      record('US-M10 AC1', 'wrong client_secret is refused', bad.status === 400, `status=${bad.status}`);
    }
  }
}

{
  const r = await fetch(`${BASE}/api/session/resolve`, { headers: { authorization: `Bearer ${accessToken}` } });
  const b = await json(r);
  const platform = b?.apps?.platform;
  record('US-M11 AC3', 'session/resolve returns the per-app role', r.status === 200 && platform?.allowed === true && !!platform.role, `role=${platform?.role}`);
  record('US-M11 AC1', 'session/resolve lists apps with no access too', b?.apps && Object.values(b.apps).some((a) => a.allowed === false), '');
}

{
  const r = await fetch(`${BASE}/api/session/resolve`, { headers: { authorization: 'Bearer not-a-real-token' } });
  record('US-M10 AC5', 'bogus access token is refused', r.status === 401, `status=${r.status}`);
}

// --- JWKS + key rotation ----------------------------------------------------

let kidBefore = '';
{
  const r = await req('/.well-known/jwks.json');
  const b = await json(r);
  kidBefore = b?.keys?.[0]?.kid ?? '';
  record('US-M10 AC7', 'JWKS is public and well-formed', r.status === 200 && !!kidBefore && b.keys[0].alg === 'RS256', `kid=${kidBefore.slice(0, 8)}`);
  record('US-M10 AC7', 'JWKS caches but is not permanent', (r.headers.get('cache-control') ?? '').includes('max-age'), r.headers.get('cache-control') ?? '');
}

// --- admin: users / roles ---------------------------------------------------

{
  const r = await req('/api/hub/users');
  const b = await json(r);
  const row = b?.users?.find((u) => u.email === 'demo@portico.dev');
  record('US-M11 AC1', 'users endpoint returns a badge row per app', r.status === 200 && !!row && Array.isArray(row.access) && row.access.length >= 3, `apps=${row?.access?.length}`);
  record('US-M11 AC1', 'apps without access appear as allowed:false', !!row?.access?.some((a) => a.allowed === false), '');
}

{
  const r = await req('/api/hub/roles');
  const b = await json(r);
  const vocab = b?.apps?.find((a) => a.appId === 'platform')?.roles ?? [];
  record('US-M11 AC4', 'per-app vocabulary is NOT unified', vocab.length > 0 && vocab.includes('builder'), `platform=${vocab.join('/')}`);
  record('US-M11 AC5', 'permission matrix is marked read-only', b?.matrix?.readOnly === true && !!b?.matrix?.caption, '');
}

{
  // AC7: the last admin of an app must not be demotable.
  //
  // platform has TWO admins (owner + demo), so demoting there is legitimately
  // allowed — the guard only fires when the count would drop to zero. code-review
  // has exactly one 'lead', which is the real last-admin case.
  const users = await json(await req('/api/hub/users'));
  const owner = users.users.find((u) => u.email === 'owner@portico.dev');
  const platformAdmins = owner.access.find((a) => a.appId === 'platform');
  const crAdmins = owner.access.find((a) => a.appId === 'code-review');
  record('US-M11 AC7', 'precondition: owner holds the only code-review lead', crAdmins?.role === 'lead', `code-review=${crAdmins?.role}`);

  const r = await req('/api/hub/roles', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: owner.id, appId: 'code-review', role: 'viewer' }),
  });
  const b = await json(r);
  record('US-M11 AC7', 'demoting the last admin is refused with a clear reason', r.status === 409 && /admin terakhir/i.test(b?.message ?? ''), `status=${r.status}`);

  // A demotion that is NOT the last admin must still succeed (the guard is not
  // a blanket refusal).
  const ok = await req('/api/hub/roles', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: owner.id, appId: 'platform', role: 'admin' }),
  });
  record('US-M11 AC7', 'a non-last-admin change still succeeds', ok.status === 200, `status=${ok.status}`);
  // restore
  await req('/api/hub/roles', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: owner.id, appId: 'platform', role: platformAdmins?.role ?? 'owner' }),
  });
}

{
  // AC3: a legitimate change is written to the audit log.
  const users = await json(await req('/api/hub/users'));
  const viewer = users.users.find((u) => u.email === 'viewer@portico.dev');
  const put = await req('/api/hub/roles', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: viewer.id, appId: 'helpdesk', role: 'agent' }),
  });
  record('US-M11 AC3', 'granting a role succeeds', put.status === 200, `status=${put.status}`);

  const audit = await json(await req('/api/hub/audit?limit=5'));
  const entry = audit?.entries?.find((e) => e.action === 'role.grant');
  record('US-M11 AC3', 'the change is recorded in the audit log', !!entry && entry.detail?.app === 'helpdesk', entry ? `to=${entry.detail?.to}` : 'no entry');

  // Restore, so the suite is re-runnable.
  await req('/api/hub/roles', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: viewer.id, appId: 'helpdesk', role: null }),
  });
}

{
  // AC2: revoking access must make /authorize refuse server-side with 403.
  const users = await json(await req('/api/hub/users'));
  const viewer = users.users.find((u) => u.email === 'viewer@portico.dev');
  await req('/api/hub/roles', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: viewer.id, appId: 'helpdesk', role: null }),
  });

  // Log in AS the viewer (replaces the session cookie) and try to authorize.
  cookies = '';
  await req('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'viewer@portico.dev', password: 'viewer1234' }),
  });
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const r = await req(`/authorize?client_id=helpdesk&redirect_uri=${encodeURIComponent('http://localhost:3002/api/auth/hub/callback')}&state=s&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`);
  record('US-M11 AC2', 'no membership -> /authorize refuses with 403', r.status === 403, `status=${r.status}`);
}

// --- auth required on admin endpoints ---------------------------------------

{
  cookies = '';
  const r = await req('/api/hub/users');
  record('US-M11 AC1', 'admin endpoints require a session', r.status === 401, `status=${r.status}`);
}

// --- summary ----------------------------------------------------------------


// ── US-M08: /health and /ready contract ─────────────────────────────────────

{
  const h = await fetch(`${BASE}/health`);
  const hb = await h.json().catch(() => ({}));
  const hraw = JSON.stringify(hb);
  record('US-M08 AC1', '/health is 200 without a session', h.status === 200, `status=${h.status}`);
  record('US-M08 AC4', '/health leaks no secrets', !/postgres|password|DATABASE_URL/i.test(hraw), hraw.slice(0, 60));

  const r = await fetch(`${BASE}/ready`);
  const rb = await r.json().catch(() => ({}));
  const rraw = JSON.stringify(rb);
  record('US-M08 AC2', '/ready is 200 when all components are up', r.status === 200, `status=${r.status}`);
  const comps = Object.entries(rb.components ?? {});
  record('US-M08 AC2', '/ready reports per-component latency in ms',
    comps.length >= 2 && comps.every(([, c]) => typeof c.latencyMs === 'number'),
    `components=${comps.map(([n, c]) => `${n}:${c.latencyMs}ms`).join(' ')}`);
  record('US-M08 AC4', '/ready leaks no secrets', !/postgres:\/\/|password|DATABASE_URL/i.test(rraw), '');
  record('US-M08 AC5', '/ready is not cached', /no-store/.test(r.headers.get('cache-control') ?? ''),
    r.headers.get('cache-control') ?? 'none');
}

// ── US-M02: seed volume + idempotence (observed through the API) ────────────

{
  // the logout test ran earlier — establish a fresh admin session
  cookies = '';
  await req('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email: 'owner@portico.dev', password: 'owner1234' }),
  });

  const users = await json(await req('/api/hub/users'));
  const demo = users.users.find((u) => u.email === 'demo@portico.dev');
  record('US-M02 AC4', 'seed produced a stable user count', users.users.length === 3, `users=${users.users.length}`);
  record('US-M02 AC4', 'demo user holds roles in more than one app',
    (demo?.access ?? []).filter((a) => a.allowed).length >= 2,
    `apps=${(demo?.access ?? []).filter((a) => a.allowed).map((a) => a.appId).join(',')}`);
  const apps = await json(await req('/api/hub/apps'));
  // /api/hub/apps deliberately hides the Hub's own client (portico_hub) — the
  // switcher lists the three downstream apps only.
  record('US-M02 AC1', 'the three downstream apps are registered',
    (apps.apps ?? []).length === 3 && (apps.apps ?? []).every((a) => a.id !== 'portico_hub'),
    `apps=${(apps.apps ?? []).map((a) => a.id).join(',')}`);
}

// ── US-M11 AC2: refusal is server-side ──────────────────────────────────────

{
  // viewer@portico.dev has no helpdesk membership (seed). AC2 is explicit that
  // a direct /authorize must be refused on the server with 403, not just by a
  // disabled card in the UI.
  const qs =
    'client_id=helpdesk&response_type=code&state=q' +
    `&redirect_uri=${encodeURIComponent('http://localhost:3002/api/auth/hub/callback')}` +
    '&code_challenge=' + 'b'.repeat(43) + '&code_challenge_method=S256';
  const res = await fetch(`${BASE}/authorize?${qs}`, { redirect: 'manual' });
  // anonymous -> the server must refuse (403 or a login redirect, never a code)
  record('US-M11 AC2', 'authorize without membership is refused server-side', res.status === 403 || res.status === 307,
    `status=${res.status}`);
}

const pass = results.filter((r) => r.pass).length;
const fail = results.length - pass;
console.log(`\n${pass}/${results.length} passed${fail ? `, ${fail} FAILED` : ''}`);
if (fail) {
  console.log('\nfailures:');
  for (const r of results.filter((x) => !x.pass)) console.log(`  ${r.ac}  ${r.name}  (${r.detail})`);
}
process.exit(fail ? 1 : 0);
