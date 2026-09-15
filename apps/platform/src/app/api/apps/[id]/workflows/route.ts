import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { appInOrg } from '@/lib/tenant';

const ALLOWED_TRIGGERS = new Set(['form_submit', 'cron', 'webhook', 'button']);

/**
 * GET /api/apps/[id]/workflows — list workflows.
 * POST /api/apps/[id]/workflows — create workflow.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');

  // US-A04 AC6
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  const wfs = await query('SELECT * FROM workflows WHERE app_id = $1 ORDER BY created_at DESC', [id]);
  return NextResponse.json({ workflows: wfs.rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  const { name, trigger_type, config_json } = await req.json().catch(() => ({}));
  if (!name) return jsonError(400, 'missing', 'Nama workflow wajib.');
  if (!trigger_type || !ALLOWED_TRIGGERS.has(trigger_type)) return jsonError(400, 'invalid_trigger', 'Tipe trigger tidak valid.');

  const wfId = randomBytes(8).toString('hex');
  await query(
    'INSERT INTO workflows (id, app_id, name, trigger_type, config_json) VALUES ($1, $2, $3, $4, $5)',
    [wfId, id, name, trigger_type, JSON.stringify(config_json || {})],
  );
  return NextResponse.json({ workflow: { id: wfId, app_id: id, name, trigger_type, config_json: config_json || {}, active: false } }, { status: 201 });
}
