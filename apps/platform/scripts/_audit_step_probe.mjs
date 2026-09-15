#!/usr/bin/env node
/** Probe: POST /api/workflows/:id/steps returns which id? And is there a reorder path? */
const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3110';
let cookies = '';
const json = async (r) => { try { return await r.json(); } catch { return null; } };
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
await req('/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'admin@seed.dev', password: 'seedadmin123' }),
});
const appId = (await json(await req('/api/apps', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'AUDIT step-id probe' }),
})))?.app?.id;
const wfId = (await json(await req(`/api/apps/${appId}/workflows`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'probe', trigger_type: 'form_submit' }),
})))?.workflow?.id;

const b = await json(await req(`/api/workflows/${wfId}/steps`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action_type: 'send_email', config_json: { to: 'a@b.c' } }),
}));
console.log('workflow id      :', wfId);
console.log('POST steps reply :', JSON.stringify(b));
console.log('returned step.id === workflow id ?', b?.step?.id === wfId, '(should be false — this is finding T3)');

// can we reorder? try PATCH on the step with step_order
const stepId = b?.step?.id;
const reorder = await req(`/api/workflow-steps/${stepId}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ step_order: 5 }),
});
console.log('PATCH step {step_order:5} ->', reorder.status, JSON.stringify(await json(reorder)));

// read back steps
const list = await json(await req(`/api/workflows/${wfId}/steps`));
console.log('steps readback   :', JSON.stringify(list?.steps?.map((s) => ({ id: s.id, order: s.step_order }))));

// does a single-workflow GET exist? (detail view needs it)
console.log('GET /api/workflows/:id ->', (await req(`/api/workflows/${wfId}`)).status);

// public form submit without session? (public form path)
const anon = await fetch(`${BASE}/api/apps/${appId}/data`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ row_json: { x: 1 } }),
});
console.log('anon POST /data  ->', anon.status, '(403/401 means no public form path exists)');

await req(`/api/apps/${appId}`, { method: 'DELETE' });
console.log('cleanup          ->', 'ok');
