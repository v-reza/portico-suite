import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query, one } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

/**
 * GET /api/orgs/invitations — list pending invitations for caller's org.
 *
 * Admin-only: the list exposes the addresses of people who have not joined
 * yet. A builder managing members is exactly what US-A04 AC2 refuses.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin yang bisa melihat undangan.');

  const invites = await query(
    `SELECT id, email, role, expires_at, created_at
     FROM invitations
     WHERE org_id = $1 AND accepted_at IS NULL
     ORDER BY created_at DESC`,
    [user.org_id],
  );
  return NextResponse.json({ invitations: invites.rows });
}

/**
 * POST /api/orgs/invitations — send an invitation (US-A03 AC1/AC4).
 *
 * AC1: Rina invites email as role -> recorded as pending invitation.
 * AC4: If email is already a member of this workspace, duplicate is rejected.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin yang bisa mengundang anggota.');

  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? '').trim().toLowerCase();
  const role = body.role ?? 'viewer';

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonError(400, 'invalid_email', 'Email tidak valid.');
  }
  if (!['admin', 'builder', 'viewer'].includes(role)) {
    return jsonError(400, 'invalid_role', 'Peran tidak valid.');
  }

  // AC4: reject if email is ALREADY a member of this workspace
  const member = await one('SELECT id FROM users WHERE org_id = $1 AND lower(email) = $2', [user.org_id, email]);
  if (member) {
    return jsonError(409, 'already_member', 'Email sudah terdaftar sebagai anggota workspace ini.');
  }

  // Generate 24-hour expiration token (US-A03 AC2/AC3)
  const id = randomBytes(8).toString('hex');
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Upsert: if an existing pending invitation exists, update it with a new token & expires
  try {
    const res = await query(
      `INSERT INTO invitations (id, org_id, email, role, token, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (org_id, email) DO UPDATE
         SET role = EXCLUDED.role,
             token = EXCLUDED.token,
             expires_at = EXCLUDED.expires_at,
             accepted_at = NULL,
             created_at = NOW()
       RETURNING id, email, role, token, expires_at, created_at`,
      [id, user.org_id, email, role, token, expiresAt, user.id],
    );

    return NextResponse.json({
      invitation: res.rows[0],
      inviteUrl: `/invite/${token}`,
    }, { status: 201 });
  } catch (e: any) {
    throw e;
  }
}
