import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin.');

  const app = await query('SELECT id, is_published FROM apps WHERE id = $1', [id]);
  if (!app.rows.length) return jsonError(404, 'not_found', 'App tidak ditemukan.');

  await query('UPDATE apps SET is_published = NOT is_published WHERE id = $1', [id]);
  return NextResponse.json({ is_published: !app.rows[0].is_published });
}
