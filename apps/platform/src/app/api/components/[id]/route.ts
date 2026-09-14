import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  await query('DELETE FROM components WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  const { config_json } = await req.json().catch(() => ({}));
  await query('UPDATE components SET config_json = $1 WHERE id = $2', [JSON.stringify(config_json || {}), id]);
  return NextResponse.json({ ok: true });
}
