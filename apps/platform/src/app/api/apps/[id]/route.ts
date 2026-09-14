import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin.');

  const app = await query('SELECT id FROM apps WHERE id = $1 AND org_id = $2', [id, user.org_id]);
  if (!app.rows.length) return jsonError(404, 'not_found', 'App tidak ditemukan.');

  await query('DELETE FROM apps WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  const app = await query('SELECT id FROM apps WHERE id = $1 AND org_id = $2', [id, user.org_id]);
  if (!app.rows.length) return jsonError(404, 'not_found', 'App tidak ditemukan.');

  const { name, slug, description } = await req.json().catch(() => ({}));
  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (name) { updates.push(`name = $${i++}`); values.push(name); }
  if (slug) { updates.push(`slug = $${i++}`); values.push(slug); }
  if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }

  if (!updates.length) return jsonError(400, 'no_changes', 'Tidak ada perubahan.');
  values.push(id);

  await query(`UPDATE apps SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i}`, values);
  return NextResponse.json({ ok: true });
}
