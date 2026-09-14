import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

const ALLOWED_ACTIONS = new Set(['send_email', 'call_api', 'create_row', 'update_row', 'delete_row', 'slack_notify', 'webhook_out', 'condition']);

/**
 * GET /api/workflows/[id]/steps — list steps.
 * POST /api/workflows/[id]/steps — add step.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  const steps = await query('SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order', [id]);
  return NextResponse.json({ steps: steps.rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  const wf = await query('SELECT id FROM workflows WHERE id = $1', [id]);
  if (!wf.rows.length) return jsonError(404, 'not_found', 'Workflow tidak ditemukan.');

  const { action_type, config_json, on_error } = await req.json().catch(() => ({}));
  if (!action_type || !ALLOWED_ACTIONS.has(action_type)) return jsonError(400, 'invalid_action', 'Tipe aksi tidak valid.');

  const stepId = randomBytes(8).toString('hex');
  const count = await query('SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = $1', [id]);
  const stepOrder = parseInt(count.rows[0].count) || 0;

  await query(
    'INSERT INTO workflow_steps (id, workflow_id, step_order, action_type, config_json, on_error) VALUES ($1, $2, $3, $4, $5, $6)',
    [stepId, id, stepOrder, action_type, JSON.stringify(config_json || {}), on_error || 'continue']
  );
  return NextResponse.json({ step: { id, workflow_id: id, step_order: stepOrder, action_type, config_json: config_json || {}, on_error: on_error || 'continue' } }, { status: 201 });
}
