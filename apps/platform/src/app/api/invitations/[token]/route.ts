import { NextResponse } from 'next/server';
import { one } from '@/lib/db';

/**
 * GET /api/invitations/[token] — check invitation validity (US-A03 AC2/AC3/AC5).
 *
 * Returns the invitation if valid, specific error codes for expired/already-used cases.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invite = await one(
    'SELECT id, org_id, email, role, expires_at, accepted_at FROM invitations WHERE token = $1',
    [token],
  );

  if (!invite) {
    return NextResponse.json(
      { error: 'not_found', message: 'Undangan tidak ditemukan.' },
      { status: 404 },
    );
  }

  // AC5: token already used
  if (invite.accepted_at) {
    return NextResponse.json(
      { error: 'already_used', message: 'Undangan ini sudah dipakai.' },
      { status: 410 },
    );
  }

  // AC3: token expired (past 24h)
  const now = new Date();
  if (new Date(invite.expires_at) < now) {
    return NextResponse.json(
      { error: 'expired', message: 'Undangan sudah kedaluwarsa.', invitation: invite },
      { status: 410 },
    );
  }

  // AC2: valid
  return NextResponse.json({ invitation: invite, valid: true });
}