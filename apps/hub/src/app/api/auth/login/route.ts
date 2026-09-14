import { NextResponse, type NextRequest } from 'next/server';
import { one, query } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { audit } from '@/lib/audit';
import { newSessionId, SESSION_COOKIE, sessionCookieOptions, signSessionId, SESSION_TTL_MS } from '@/lib/session';
import { jsonError, sameOrigin } from '@/lib/auth';

/**
 * POST /api/auth/login — local email+password login.
 *
 * This is the path that MUST keep working when the Hub is unreachable from an
 * app (US-M10 AC3). It is also the only credential check in the Hub; apps never
 * see a password.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'bad_origin', 'Origin tidak dikenal.');

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'bad_json', 'Body bukan JSON.');
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!email || !password) {
    return jsonError(400, 'missing_credentials', 'Email dan password wajib diisi.');
  }

  const user = await one<{
    id: string; email: string; display_name: string; password_hash: string; is_active: boolean;
  }>('SELECT id, email, display_name, password_hash, is_active FROM hub_users WHERE email = $1', [email]);

  // One generic failure for both "no such user" and "wrong password" so the
  // response cannot be used to enumerate accounts.
  const ok = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !ok || !user.is_active) {
    return jsonError(401, 'invalid_credentials', 'Email atau password salah.');
  }

  const sid = newSessionId();
  await query(
    'INSERT INTO hub_sessions (id, user_id, expires_at) VALUES ($1, $2, now() + ($3 || \' milliseconds\')::interval)',
    [sid, user.id, String(SESSION_TTL_MS)],
  );
  await query('UPDATE hub_users SET last_login_at = now() WHERE id = $1', [user.id]);
  await audit(user.id, 'user.login', user.email, { via: 'hub' });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.display_name },
  });
  res.cookies.set(SESSION_COOKIE, signSessionId(sid), sessionCookieOptions());
  return res;
}
