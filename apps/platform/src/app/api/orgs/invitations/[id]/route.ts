import { NextResponse, type NextRequest } from 'next/server';
import { query, one } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

/**
 * DELETE /api/orgs/invitations/[id] — cancel a pending invitation (rescind).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin yang bisa membatalkan undangan.');

  const invite = await one(
    'SELECT id FROM invitations WHERE id = $1 AND org_id = $2 AND accepted_at IS NULL',
    [id, user.org_id],
  );
  if (!invite) return jsonError(404, 'not_found', 'Undangan tidak ditemukan.');

  await query('DELETE FROM invitations WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}