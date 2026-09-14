import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  const wf = await query('SELECT id, active FROM workflows WHERE id = $1', [id]);
  if (!wf.rows.length) return jsonError(404, 'not_found', 'Workflow tidak ditemukan.');

  await query('UPDATE workflows SET active = NOT active WHERE id = $1', [id]);
  return NextResponse.json({ active: !wf.rows[0].active });
}
