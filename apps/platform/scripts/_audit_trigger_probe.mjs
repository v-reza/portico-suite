#!/usr/bin/env node
/**
 * READ-ONLY audit probe: does any trigger actually fire a workflow run?
 * Creates one app + workflow + step, fires the closest thing to a form submit
 * (POST /api/apps/:id/data), then counts workflow_runs. Deletes everything after.
 */
const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3110';
let cookies = '';
const out = [];
function note(k, v) { out.push(`${k}: ${v}`); console.log(`${k}: ${v}`); }

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

const login = await req('/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123' }),
});
note('login', login.status);

const appR = await req('/api/apps', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'AUDIT Workflow Probe', description: 'probe' }),
});
const appId = (await json(appR))?.app?.id;
note('app created', `${appR.status} ${appId}`);

const wfR = await req(`/api/apps/${appId}/workflows`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Audit probe WF', trigger_type: 'form_submit', config_json: {} }),
});
const wfId = (await json(wfR))?.workflow?.id;
note('workflow created (form_submit)', `${wfR.status} ${wfId} active=false`);

const stepR = await req(`/api/workflows/${wfId}/steps`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action_type: 'create_row', config_json: {} }),
});
note('step created (create_row)', `${stepR.status}`);

// Activate it — this is the closest thing to "the trigger should now fire"
const togR = await req(`/api/workflows/${wfId}/toggle`, { method: 'PATCH' });
note('workflow activated', `${togR.status} ${JSON.stringify(await json(togR))}`);

// Fire the "form submit" path that exists today: POST /api/apps/:id/data
const submitR = await req(`/api/apps/${appId}/data`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ row_json: { nama: 'Probe', email: 'probe@example.com' } }),
});
note('POST /data (closest thing to form submit)', submitR.status);

// Also try a webhook-ish path and a cron-ish path
const whR = await req(`/api/workflows/${wfId}/run`, { method: 'POST' });
note('POST /api/workflows/:id/run (guessed endpoint)', whR.status);
const runR = await req(`/api/workflows/${wfId}/runs`);
note('GET /api/workflows/:id/runs (guessed endpoint)', runR.status);

// Did any run appear? (direct pg, the app's db.ts is TypeScript)
import { readFileSync } from 'node:fs';
import pg from 'pg';
const env = Object.fromEntries(
  readFileSync('../../.env', 'utf-8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; })
);
const pool = new pg.Pool({ connectionString: env.PLATFORM_DATABASE_URL });
const rows = await pool.query('SELECT id, status, trigger_by, created_at FROM workflow_runs WHERE workflow_id = $1', [wfId]);
note('workflow_runs rows after firing trigger', rows.rowCount);
const steps = await pool.query('SELECT id FROM workflow_steps WHERE workflow_id = $1', [wfId]);
note('workflow_steps rows', steps.rowCount);
await pool.end();

// cleanup
const del = await req(`/api/apps/${appId}`, { method: 'DELETE' });
note('cleanup DELETE /api/apps/:id', del.status);
console.log('\n' + out.join('\n'));
