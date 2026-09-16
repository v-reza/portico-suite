import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query, one, pool } from '@/lib/db';
import { hashPassword, passwordProblem } from '@/lib/password';
import { makeSessionValue, SESSION_COOKIE } from '@/lib/session';
import { jsonError } from '@/lib/auth';

/**
 * POST /api/invitations/[token]/accept — accept an invitation (US-A03 AC2/AC3/AC5).
 *
 * AC2: if valid (within 24h), user fills name + password and gets an active account in
 *      the org with the correct role. Session is created so they land already logged in.
 * AC3: if expired, returns 410 — the UI shows the expired page instead.
 * AC5: if already accepted, returns 410 — single-use token enforced by `accepted_at` guard.
 */
export async function POST(
  req: NextRequest,
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

  // AC5: already used
  if (invite.accepted_at) {
    return NextResponse.json(
      { error: 'already_used', message: 'Undangan ini sudah dipakai.' },
      { status: 410 },
    );
  }

  // AC3: expired
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'expired', message: 'Undangan sudah kedaluwarsa.' },
      { status: 410 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? '').trim();
  const password = body.password ?? '';
  const confirm = body.confirm ?? '';

  if (!name) return jsonError(400, 'missing', 'Nama wajib diisi.');
  const problem = passwordProblem(password);
  if (problem) return jsonError(400, 'weak_password', problem);
  if (password !== confirm) return jsonError(400, 'password_mismatch', 'Konfirmasi password tidak sama.');

  // Double-check: the email might have registered in the meantime via another path
  const existing = await one('SELECT id FROM users WHERE lower(email) = $1', [invite.email]);
  if (existing) {
    return jsonError(409, 'already_member', 'Email ini sudah terdaftar.');
  }

  const userId = randomBytes(8).toString('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // AC5 under concurrency: claim the token with a conditional UPDATE rather
    // than trusting the read above. Two simultaneous accepts both pass the
    // `accepted_at` check; only one wins this UPDATE, so only one account is
    // created. A read-then-write would let both through.
    const claim = await client.query(
      'UPDATE invitations SET accepted_at = NOW() WHERE id = $1 AND accepted_at IS NULL RETURNING id',
      [invite.id],
    );
    if (!claim.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'already_used', message: 'Undangan ini sudah dipakai.' },
        { status: 410 },
      );
    }

    await client.query(
      `INSERT INTO users (id, email, name, org_id, role, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, invite.email, name, invite.org_id, invite.role, await hashPassword(password)],
    );

    // Log the member join in the same transaction as the account.
    await client.query(
      `INSERT INTO activity_logs (id, org_id, user_id, action, entity_type, entity_id, meta_json)
       VALUES ($1, $2, $3, 'member_joined', 'user', $4, '{}'::jsonb)`,
      [randomBytes(8).toString('hex'), invite.org_id, userId, userId],
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    // The email registered through another path between the check and here.
    if ((e as { code?: string })?.code === '23505') {
      return jsonError(409, 'already_member', 'Email ini sudah terdaftar.');
    }
    throw e;
  } finally {
    client.release();
  }

  // Create session for the new user so they land logged in (AC2)
  const value = makeSessionValue(userId);
  const res = NextResponse.json({
    ok: true,
    user: { id: userId, email: invite.email, name, role: invite.role, org_id: invite.org_id },
  }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}