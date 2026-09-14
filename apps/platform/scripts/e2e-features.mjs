#!/usr/bin/env node
/**
 * E2E test for Platform features: pages, components, workflows, AI generation.
 * Run: node scripts/e2e-features.mjs
 */
const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3001';
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
    if (name === 'po_session') cookies = pair;
  }
  return res;
}

const json = async (r) => { try { return await r.json(); } catch { return null; } };

// ── US-A02 AC1: login ─────────────────────────────────────────────────────
{
  const r = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123' }),
  });
  record('US-A02 AC1', 'login as admin', r.status === 200, `status=${r.status}`);
}

// ── US-A05 AC1: create app ────────────────────────────────────────────────
let appId;
{
  const r = await req('/api/apps', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Feature App', description: 'Created by e2e-features' }),
  });
  const b = await json(r);
  appId = b?.app?.id;
  record('US-A05 AC1', 'create app', r.status === 201 && !!appId, `status=${r.status} id=${appId}`);
}

// ── US-A11 AC1: pages ─────────────────────────────────────────────────────
let pageId;
{
  const r = await req(`/api/apps/${appId}/pages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Form', route: '/form' }),
  });
  const b = await json(r);
  pageId = b?.page?.id;
  record('US-A11 AC1', 'create page', r.status === 201 && !!pageId, `status=${r.status} id=${pageId}`);
}
{
  const r = await req(`/api/apps/${appId}/pages`);
  const b = await json(r);
  record('US-A11 AC1', 'list pages', r.status === 200 && b?.pages?.length === 1, `count=${b?.pages?.length}`);
}

// ── US-A09: components ────────────────────────────────────────────────────
let compId;
{
  const r = await req(`/api/pages/${pageId}/components`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'text', config_json: { label: 'Nama', required: true } }),
  });
  const b = await json(r);
  compId = b?.component?.id;
  record('US-A09 AC1', 'create component', r.status === 201 && !!compId, `status=${r.status} id=${compId}`);
}
{
  const r = await req(`/api/pages/${pageId}/components`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'email', config_json: { label: 'Email' } }),
  });
  record('US-A09 AC1', 'create second component', r.status === 201, `status=${r.status}`);
}
{
  const r = await req(`/api/pages/${pageId}/components`);
  const b = await json(r);
  record('US-A09 AC1', 'list components', r.status === 200 && b?.components?.length === 2, `count=${b?.components?.length}`);
}
{
  // Invalid type must be refused (PRD: whitelist check)
  const r = await req(`/api/pages/${pageId}/components`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'hacky_type' }),
  });
  record('US-A09 AC1', 'invalid type refused', r.status === 400, `status=${r.status}`);
}
{
  const r = await req(`/api/components/${compId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config_json: { label: 'Nama Lengkap', required: true } }),
  });
  record('US-A09 AC4', 'update component config', r.status === 200, `status=${r.status}`);
}

// ── US-A20/A21: workflows ─────────────────────────────────────────────────
let wfId;
{
  const r = await req(`/api/apps/${appId}/workflows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Notify on submit', trigger_type: 'form_submit' }),
  });
  const b = await json(r);
  wfId = b?.workflow?.id;
  record('US-A20 AC2', 'create workflow', r.status === 201 && !!wfId, `status=${r.status} id=${wfId}`);
}
{
  // Invalid trigger refused
  const r = await req(`/api/apps/${appId}/workflows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Bad', trigger_type: 'carrier_pigeon' }),
  });
  record('US-A20 AC6', 'invalid trigger refused', r.status === 400, `status=${r.status}`);
}
let stepId;
{
  const r = await req(`/api/workflows/${wfId}/steps`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action_type: 'create_row', config_json: {} }),
  });
  const b = await json(r);
  stepId = b?.step?.id;
  record('US-A21 AC1', 'add workflow step', r.status === 201 && !!stepId, `status=${r.status} id=${stepId}`);
}
{
  const r = await req(`/api/workflows/${wfId}/steps`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action_type: 'slash_and_burn' }),
  });
  record('US-A21 AC1', 'invalid action refused', r.status === 400, `status=${r.status}`);
}
{
  const r = await req(`/api/workflows/${wfId}/toggle`, { method: 'PATCH' });
  const b = await json(r);
  record('US-A20 AC2', 'toggle workflow active', r.status === 200 && b?.active === true, `status=${r.status} active=${b?.active}`);
}
{
  const r = await req(`/api/workflows/${wfId}/toggle`, { method: 'PATCH' });
  const b = await json(r);
  record('US-A20 AC5', 'toggle workflow back off', r.status === 200 && b?.active === false, `active=${b?.active}`);
}

// ── US-A14/A15: AI generation ────────────────────────────────────────────
const aiAppIds = [];
{
  const r = await req('/api/ai/generate-app', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'buatin form input data supplier dengan notifikasi email' }),
  });
  const b = await json(r);
  const ok = r.status === 201 && b?.app?.id;
  if (ok) aiAppIds.push(b.app.id);
  record('US-A14 AC1', 'AI generate-app (form prompt)', ok, `status=${r.status} slug=${b?.app?.slug}`);
  if (ok) {
    // verify pages + components actually created
    const pr = await req(`/api/apps/${b.app.id}/pages`);
    const pb = await json(pr);
    record('US-A14 AC1', 'AI app has pages', pr.status === 200 && pb?.pages?.length >= 1, `pages=${pb?.pages?.length}`);
    const cr = await req(`/api/pages/${pb.pages[0].id}/components`);
    const cb = await json(cr);
    record('US-A14 AC1', 'AI page has components', cr.status === 200 && cb?.components?.length >= 3, `components=${cb?.components?.length}`);
  }
}
{
  const r = await req('/api/ai/generate-app', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'abc' }),
  });
  record('US-A15 AC1', 'AI rejects short prompt', r.status === 400, `status=${r.status}`);
}
{
  const r = await req('/api/ai/generate-app', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'x'.repeat(501) }),
  });
  record('US-A15 AC6', 'AI rejects >500 char prompt', r.status === 400, `status=${r.status}`);
}
{
  const r = await req('/api/ai/generate-app', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'buat crm untuk tracking pelanggan dan sales' }),
  });
  const b = await json(r);
  if (b?.app?.id) aiAppIds.push(b.app.id);
  record('US-A14 AC1', 'AI generate-app (CRM prompt)', r.status === 201, `status=${r.status} slug=${b?.app?.slug}`);
}
{
  const r = await req('/api/ai/generate-app', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'toko online untuk jual produk dengan kategori' }),
  });
  const b = await json(r);
  if (b?.app?.id) aiAppIds.push(b.app.id);
  record('US-A14 AC1', 'AI generate-app (shop prompt)', r.status === 201, `status=${r.status} slug=${b?.app?.slug}`);
}

// ── US-A18 AC1: data rows ─────────────────────────────────────────────────
{
  const r = await req(`/api/apps/${appId}/data`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ row_json: { nama: 'Budi', email: 'budi@example.com' } }),
  });
  record('US-A18 AC1', 'insert data row', r.status === 201, `status=${r.status}`);
}
{
  const r = await req(`/api/apps/${appId}/data`);
  const b = await json(r);
  record('US-A18 AC1', 'list data rows', r.status === 200 && b?.rows?.length === 1, `rows=${b?.rows?.length}`);
}

// ── publish ────────────────────────────────────────────────────────────────
{
  const r = await req(`/api/apps/${appId}/publish`, { method: 'POST' });
  const b = await json(r);
  record('US-A08 AC2', 'publish app', r.status === 200 && b?.is_published === true, `published=${b?.is_published}`);
}

// ── cleanup: delete the test app ──────────────────────────────────────────
{
  const r = await req(`/api/apps/${appId}`, { method: 'DELETE' });
  record('US-A07 AC5', 'delete test app', r.status === 200, `status=${r.status}`);
}
for (const id of aiAppIds) {
  await req(`/api/apps/${id}`, { method: 'DELETE' });
}

// ── summary ────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.pass).length;
const fail = results.length - pass;
console.log(`\n${pass}/${results.length} passed${fail ? `, ${fail} FAILED` : ''}`);
if (fail) {
  console.log('\nfailures:');
  for (const r of results.filter((x) => !x.pass)) console.log(`  ${r.ac}  ${r.name}  (${r.detail})`);
}
process.exit(fail ? 1 : 0);
