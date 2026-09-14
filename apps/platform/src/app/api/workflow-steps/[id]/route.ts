import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  await query('DELETE FROM workflow_steps WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  const { config_json, on_error } = await req.json().catch(() => ({}));
  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (config_json !== undefined) { updates.push(`config_json = $${i++}`); values.push(JSON.stringify(config_json)); }
  if (on_error) { updates.push(`on_error = $${i++}`); values.push(on_error); }

  if (!updates.length) return jsonError(400, 'no_changes', 'Tidak ada perubahan.');
  values.push(id);

  await query(`UPDATE workflow_steps SET ${updates.join(', ')} WHERE id = $${i}`, values);
  return NextResponse.json({ ok: true });
}
