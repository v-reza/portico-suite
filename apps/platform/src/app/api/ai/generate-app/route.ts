import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

const ALLOWED_TYPES = new Set(['text','number','email','textarea','select','checkbox','date','file','button','table','heading','divider','rich_text','rating']);
const ALLOWED_TRIGGERS = new Set(['form_submit', 'cron', 'webhook', 'button']);
const ALLOWED_ACTIONS = new Set(['send_email', 'call_api', 'create_row', 'update_row', 'delete_row', 'slack_notify', 'webhook_out', 'condition']);

/**
 * POST /api/ai/generate-app — generate app spec from prompt.
 *
 * Uses a deterministic rule-based generator (no external LLM needed for portfolio).
 * Validates the spec through the same pipeline the PRD describes.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  const { prompt } = await req.json().catch(() => ({}));
  if (!prompt || typeof prompt !== 'string' || prompt.length < 5) {
    return jsonError(400, 'invalid_prompt', 'Prompt minimal 5 karakter.');
  }
  if (prompt.length > 500) {
    return jsonError(400, 'prompt_too_long', 'Prompt maksimal 500 karakter.');
  }

  const spec = generateFromPrompt(prompt);
  const errors = validateSpec(spec);
  if (errors.length) return jsonError(422, 'validation_failed', errors.join('; '));

  // DB transaction
  const appId = randomBytes(8).toString('hex');
  const slug = spec.app.slug;

  // Check slug uniqueness per org
  const existing = await query('SELECT id FROM apps WHERE org_id = $1 AND slug = $2', [user.org_id, slug]);
  if (existing.rows.length) return jsonError(409, 'slug_taken', 'Slug sudah dipakai.');

  await query(
    'INSERT INTO apps (id, org_id, name, slug, description, is_published) VALUES ($1, $2, $3, $4, $5, false)',
    [appId, user.org_id, spec.app.name, slug, spec.app.description || null]
  );

  for (const page of spec.pages) {
    const pageId = randomBytes(8).toString('hex');
    await query(
      'INSERT INTO pages (id, app_id, name, route, order_index) VALUES ($1, $2, $3, $4, $5)',
      [pageId, appId, page.name, page.route, page.order_index]
    );
    for (const comp of page.components) {
      const compId = randomBytes(8).toString('hex');
      await query(
        'INSERT INTO components (id, page_id, type, config_json, order_index) VALUES ($1, $2, $3, $4, $5)',
        [compId, pageId, comp.type, JSON.stringify(comp.config || {}), comp.order_index]
      );
    }
  }

  if (spec.workflow) {
    const wfId = randomBytes(8).toString('hex');
    await query(
      'INSERT INTO workflows (id, app_id, name, trigger_type, config_json, active) VALUES ($1, $2, $3, $4, $5, false)',
      [wfId, appId, spec.workflow.name, spec.workflow.trigger_type, JSON.stringify(spec.workflow.config || {})]
    );
    for (const step of spec.workflow.steps) {
      const stepId = randomBytes(8).toString('hex');
      await query(
        'INSERT INTO workflow_steps (id, workflow_id, step_order, action_type, config_json, on_error) VALUES ($1, $2, $3, $4, $5, $6)',
        [stepId, wfId, step.step_order, step.action_type, JSON.stringify(step.config || {}), step.on_error || 'continue']
      );
    }
  }

  await query(
    'INSERT INTO activity_logs (id, org_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [randomBytes(8).toString('hex'), user.org_id, user.id, 'app_generated', 'app', appId]
  );

  const full = await query('SELECT * FROM apps WHERE id = $1', [appId]);
  return NextResponse.json({ app: full.rows[0], is_draft: true }, { status: 201 });
}

// --- Rule-based generator (deterministic, no external LLM) ---

function generateFromPrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  const words = lower.split(/\s+/);

  // Infer app type from keywords
  const isForm = words.some(w => ['form', 'input', 'survey', 'kontak', 'contact'].includes(w));
  const isCrm = words.some(w => ['crm', 'customer', 'pelanggan', 'sales', 'lead'].includes(w));
  const isShop = words.some(w => ['toko', 'shop', 'produk', 'jual', 'order'].includes(w));

  let name = 'Generated App';
  let slug = 'generated-app';
  const pages = [];
  const components = [];

  if (isForm) {
    name = 'Form Input';
    slug = 'form-input';
    pages.push({
      name: 'Form',
      route: '/',
      order_index: 0,
      components: [
        { type: 'heading', config: { text: 'Form Input' }, order_index: 0 },
        { type: 'text', config: { label: 'Nama', required: true }, order_index: 1 },
        { type: 'email', config: { label: 'Email', required: true }, order_index: 2 },
        { type: 'textarea', config: { label: 'Pesan' }, order_index: 3 },
        { type: 'button', config: { label: 'Kirim' }, order_index: 4 },
      ]
    });
  } else if (isCrm) {
    name = 'CRM Starter';
    slug = 'crm-starter';
    pages.push({
      name: 'Leads',
      route: '/',
      order_index: 0,
      components: [
        { type: 'heading', config: { text: 'Lead Tracker' }, order_index: 0 },
        { type: 'text', config: { label: 'Nama Perusahaan', required: true }, order_index: 1 },
        { type: 'select', config: { label: 'Status', options: ['Baru', 'Follow-up', 'Deal'] }, order_index: 2 },
        { type: 'number', config: { label: 'Nilai Deal' }, order_index: 3 },
        { type: 'button', config: { label: 'Simpan Lead' }, order_index: 4 },
      ]
    });
  } else if (isShop) {
    name = 'Toko Online';
    slug = 'toko-online';
    pages.push({
      name: 'Katalog',
      route: '/',
      order_index: 0,
      components: [
        { type: 'heading', config: { text: 'Katalog Produk' }, order_index: 0 },
        { type: 'text', config: { label: 'Nama Produk', required: true }, order_index: 1 },
        { type: 'number', config: { label: 'Harga', required: true }, order_index: 2 },
        { type: 'select', config: { label: 'Kategori', options: ['Elektronik', 'Fashion', 'Makanan'] }, order_index: 3 },
        { type: 'button', config: { label: 'Tambah Produk' }, order_index: 4 },
      ]
    });
  } else {
    // Generic app
    name = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' App';
    slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    pages.push({
      name: 'Main',
      route: '/',
      order_index: 0,
      components: [
        { type: 'heading', config: { text: name }, order_index: 0 },
        { type: 'text', config: { label: 'Nama', required: true }, order_index: 1 },
        { type: 'email', config: { label: 'Email' }, order_index: 2 },
        { type: 'button', config: { label: 'Submit' }, order_index: 3 },
      ]
    });
  }

  // Add a workflow if prompt mentions automation keywords
  const hasWorkflow = words.some(w => ['auto', 'otomatis', 'notif', 'email', 'kirim'].includes(w));
  let workflow = null;
  if (hasWorkflow) {
    workflow = {
      name: 'Auto Notify',
      trigger_type: 'form_submit',
      config: {},
      steps: [
        { action_type: 'send_email', config: { to: 'admin@example.com' }, step_order: 0, on_error: 'continue' },
        { action_type: 'create_row', config: {}, step_order: 1, on_error: 'continue' },
      ]
    };
  }

  return {
    app: { name, slug, description: prompt },
    pages,
    workflow
  };
}

function validateSpec(spec: any): string[] {
  const errors: string[] = [];
  if (!spec.app?.slug || !/^[a-z0-9-]{3,40}$/.test(spec.app.slug)) errors.push('slug invalid');
  if (!spec.pages || spec.pages.length === 0) errors.push('no pages');
  if (spec.pages.length > 5) errors.push('max 5 pages');
  for (const page of spec.pages) {
    if (page.components.length > 15) errors.push(`page ${page.name} max 15 components`);
    for (const comp of page.components) {
      if (!ALLOWED_TYPES.has(comp.type)) errors.push(`invalid type: ${comp.type}`);
      if (comp.type === 'select' && (!comp.config?.options || comp.config.options.length < 2)) {
        errors.push('select needs min 2 options');
      }
    }
  }
  if (spec.workflow) {
    if (!ALLOWED_TRIGGERS.has(spec.workflow.trigger_type)) errors.push('invalid trigger');
    for (const step of spec.workflow.steps) {
      if (!ALLOWED_ACTIONS.has(step.action_type)) errors.push(`invalid action: ${step.action_type}`);
    }
  }
  return errors;
}
