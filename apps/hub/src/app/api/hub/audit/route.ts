import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth';

/**
 * GET /api/hub/audit — recent activity (US-M11 AC3: who changed what, when).
 */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return jsonError(401, 'unauthenticated', 'Login dulu.');

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50) || 50, 200);
  const rows = await query<{
    id: string; action: string; subject: string | null; detail: unknown; created_at: string;
    actor_email: string | null;
  }>(
    `SELECT a.id, a.action, a.subject, a.detail, a.created_at, u.email AS actor_email
       FROM hub_audit_log a
       LEFT JOIN hub_users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [limit],
  );

  return NextResponse.json({ entries: rows });
}
