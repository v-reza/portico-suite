import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, sameOrigin } from '@/lib/auth';

/**
 * GET /api/hub/users — every user with a badge row per app (US-M11 AC1).
 *
 * Apps the user has NO access to are returned as `{ allowed: false }`, never
 * omitted: the UI renders them greyed so an admin can see the absence.
 */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return jsonError(401, 'unauthenticated', 'Login dulu.');

  const clients = await query<{ id: string; name: string }>(
    'SELECT id, name FROM hub_clients ORDER BY id',
  );
  const users = await query<{
    id: string; email: string; display_name: string; is_active: boolean;
    last_login_at: string | null; created_at: string;
  }>(
    `SELECT id, email, display_name, is_active, last_login_at, created_at
       FROM hub_users ORDER BY created_at`,
  );
  const roles = await query<{ user_id: string; app_id: string; role: string }>(
    'SELECT user_id, app_id, role FROM hub_app_roles',
  );

  const byUser = new Map<string, Map<string, string>>();
  for (const r of roles) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Map());
    byUser.get(r.user_id)!.set(r.app_id, r.role);
  }

  return NextResponse.json({
    apps: clients,
    users: users.map((u) => {
      const held = byUser.get(u.id) ?? new Map<string, string>();
      return {
        id: u.id,
        email: u.email,
        name: u.display_name,
        active: u.is_active,
        lastLoginAt: u.last_login_at,
        // full row for every app, allowed or not
        access: clients.map((c) => ({
          appId: c.id,
          appName: c.name,
          allowed: held.has(c.id),
          role: held.get(c.id) ?? null,
        })),
      };
    }),
  });
}
