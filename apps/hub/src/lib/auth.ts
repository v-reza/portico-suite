import { NextResponse, type NextRequest } from 'next/server';
import { one } from './db';
import { SESSION_COOKIE, verifySessionCookie } from './session';

export interface HubUser {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
}

/**
 * Resolve the signed-in Hub user from the session cookie.
 *
 * Returns null for every failure mode — missing cookie, bad MAC, unknown
 * session, expired session, deactivated user. Callers cannot accidentally treat
 * a partial match as authenticated.
 */
export async function getSessionUser(req: NextRequest): Promise<HubUser | null> {
  const id = verifySessionCookie(req.cookies.get(SESSION_COOKIE)?.value);
  if (!id) return null;

  const row = await one<HubUser>(
    `SELECT u.id, u.email, u.display_name, u.is_active
       FROM hub_sessions s
       JOIN hub_users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [id],
  );
  if (!row || !row.is_active) return null;
  return row;
}

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: code, message }, { status });
}

/** Same-origin check for state-changing requests (defence in depth on top of SameSite=Lax). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser client (curl, tests) — no CSRF surface
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}
