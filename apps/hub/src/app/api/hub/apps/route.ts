import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth';

/**
 * GET /api/hub/apps — the app switcher list for the signed-in user.
 *
 * Every active app is returned with `allowed` set. A denied app is NOT omitted:
 * the UI must show it disabled with a reason (US-M11 AC1/AC2), otherwise the user
 * cannot tell "no access" apart from "does not exist".
 *
 * Note this only shapes the UI. The hard enforcement is /authorize, which
 * re-checks membership server-side and refuses with 403 — a disabled card is not
 * a security boundary.
 */
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return jsonError(401, 'unauthenticated', 'Login dulu.');

  const clients = await query<{ id: string; name: string }>(
    "SELECT id, name FROM hub_clients WHERE is_active AND id <> 'portico_hub' ORDER BY id",
  );
  const roles = await query<{ app_id: string; role: string }>(
    'SELECT app_id, role FROM hub_app_roles WHERE user_id = $1',
    [me.id],
  );
  const held = new Map(roles.map((r) => [r.app_id, r.role]));

  return NextResponse.json(
    {
      apps: clients.map((c) => ({
        appId: c.id,
        appName: c.name,
        allowed: held.has(c.id),
        role: held.get(c.id) ?? null,
        ...(held.has(c.id) ? {} : { reason: 'Akses dicabut oleh admin.' }),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
