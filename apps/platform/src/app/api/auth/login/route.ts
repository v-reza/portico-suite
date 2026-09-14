import { NextResponse, type NextRequest } from 'next/server';
import { one } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { makeSessionValue, SESSION_COOKIE } from '@/lib/session';
import { jsonError } from '@/lib/auth';

/**
 * POST /api/auth/login — local login.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return jsonError(400, 'missing', 'Email dan password wajib.');

  const u = await one('SELECT * FROM users WHERE email = $1', [email]);
  if (!u) return jsonError(401, 'invalid', 'Email atau password salah.');

  // SSO-only users have no password
  if (u.password_hash === 'sso-no-password') {
    return jsonError(401, 'sso_only', 'Akun ini terhubung via Hub. Gunakan tombol Hub.');
  }

  if (!(await verifyPassword(password, u.password_hash))) {
    return jsonError(401, 'invalid', 'Email atau password salah.');
  }

  const value = makeSessionValue(u.id);
  const res = NextResponse.json({ ok: true, user: { id: u.id, email: u.email, name: u.name, role: u.role, org_id: u.org_id } });
  res.cookies.set(SESSION_COOKIE, value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}
