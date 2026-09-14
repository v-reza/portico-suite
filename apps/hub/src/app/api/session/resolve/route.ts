import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { query } from '@/lib/db';

/**
 * GET /api/session/resolve — what may this user do, per app?
 *
 * This is the ONLY place an app learns its role. The id_token deliberately
 * carries no role claim (§5.1), so a leaked token grants identity, not
 * authority. Apps cache the answer briefly and invalidate on a 403, which is how
 * "role changes take effect without re-login" (US-M11 AC3) is implemented.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    return NextResponse.json({ error: 'invalid_token', message: 'Bearer token wajib.' }, { status: 401 });
  }

  const row = await query<{
    user_id: string; email: string; display_name: string; client_id: string;
  }>(
    `SELECT t.user_id, u.email, u.display_name, t.client_id
       FROM hub_access_tokens t
       JOIN hub_users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND t.expires_at > now()`,
    [createHash('sha256').update(token).digest('hex')],
  );
  const tok = row[0];
  if (!tok) {
    return NextResponse.json({ error: 'invalid_token', message: 'Token tidak valid atau kedaluwarsa.' }, { status: 401 });
  }

  const clients = await query<{ id: string; name: string }>(
    'SELECT id, name FROM hub_clients WHERE is_active ORDER BY id',
  );
  const roles = await query<{ app_id: string; role: string }>(
    'SELECT app_id, role FROM hub_app_roles WHERE user_id = $1',
    [tok.user_id],
  );
  const roleMap = new Map(roles.map((r) => [r.app_id, r.role]));

  // Every active app appears, allowed or not — the caller renders a disabled
  // card rather than hiding the app (US-M11 AC1/AC2).
  const apps: Record<string, { allowed: boolean; role?: string }> = {};
  for (const c of clients) {
    const role = roleMap.get(c.id);
    apps[c.id] = role ? { allowed: true, role } : { allowed: false };
  }

  return NextResponse.json(
    { user_id: tok.user_id, email: tok.email, name: tok.display_name, apps },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
