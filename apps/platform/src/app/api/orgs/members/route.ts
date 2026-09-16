import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

/**
 * GET /api/orgs/members — list every member of the caller's org (US-A03).
 *
 * "Members" are simply the users rows whose org_id matches the caller. The role
 * is read straight off each row; pending invitations are NOT members yet.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');

  const members = await query(
    `SELECT id, email, name, role, created_at
     FROM users WHERE org_id = $1
     ORDER BY
       CASE role WHEN 'admin' THEN 0 WHEN 'builder' THEN 1 ELSE 2 END,
       name ASC`,
    [user.org_id],
  );
  return NextResponse.json({ members: members.rows });
}
