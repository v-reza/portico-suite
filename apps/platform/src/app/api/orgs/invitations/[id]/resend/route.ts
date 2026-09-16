import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query, one } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

/**
 * POST /api/orgs/invitations/[id]/resend — regenerate token & extend 24h (US-A03 AC3).
 *
 * AC3: When an invitation has expired, Rina can resend. This extends the expiry by 24h
 * and generates a fresh token so the old link stops working.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin yang bisa mengirim ulang undangan.');

  const invite = await one(
    'SELECT id FROM invitations WHERE id = $1 AND org_id = $2',
    [id, user.org_id],
  );
  if (!invite) return jsonError(404, 'not_found', 'Undangan tidak ditemukan.');

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await query(
    'UPDATE invitations SET token = $1, expires_at = $2, accepted_at = NULL WHERE id = $3',
    [token, expiresAt, id],
  );

  return NextResponse.json({ ok: true, token, inviteUrl: `/invite/${token}` });
}