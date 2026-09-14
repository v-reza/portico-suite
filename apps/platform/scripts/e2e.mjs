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
