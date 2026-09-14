import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { SESSION_COOKIE, verifySessionCookie } from '@/lib/session';
import { audit } from '@/lib/audit';
import { getSessionUser } from '@/lib/auth';

/**
 * POST /api/auth/logout — drop the Hub session.
 *
 * Apps keep their own sessions; the Hub cannot reach into them (US-M10 AC4 is
 * about the Hub's own session not being half-alive after expiry). Deleting the
 * row is what makes that true — a cookie-only logout would leave the session
 * usable until it expired.
 */
export async function POST(req: NextRequest) {
  const id = verifySessionCookie(req.cookies.get(SESSION_COOKIE)?.value);
  const user = await getSessionUser(req);

  if (id) {
    // Revoke pending authorization codes too: otherwise a code issued just
    // before logout could still be exchanged for a token afterwards.
    await query(
      `UPDATE hub_auth_codes SET consumed_at = now()
        WHERE user_id = (SELECT user_id FROM hub_sessions WHERE id = $1)
          AND consumed_at IS NULL`,
      [id],
    );
    await query('DELETE FROM hub_sessions WHERE id = $1', [id]);
  }
  if (user) await audit(user.id, 'user.logout', user.email, { via: 'hub' });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

/** GET — cheap "am I signed in" probe used by the login page to skip the form. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  return NextResponse.json({ authenticated: !!user, user });
}
