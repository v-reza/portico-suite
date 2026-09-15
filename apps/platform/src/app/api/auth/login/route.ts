import { NextResponse, type NextRequest } from 'next/server';
import { one } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { makeSessionValue, SESSION_COOKIE } from '@/lib/session';
import { jsonError } from '@/lib/auth';
import { checkLoginBlock, recordLoginFailure, clearLoginFailures } from '@/lib/login-throttle';
import { safeNextPath } from '@/lib/next-path';

/**
 * POST /api/auth/login — local login.
 *
 * US-A02: AC2 answers one generic message for both "no such email" and "wrong
 * password" (naming which one was wrong is a user-enumeration oracle); AC3
 * blocks an email for 15 minutes after 5 failures in 10; AC4 carries `next`
 * through so the user lands back on the page they were denied.
 */
export async function POST(req: NextRequest) {
  const { email, password, next } = await req.json().catch(() => ({}));
  if (!email || !password) return jsonError(400, 'missing', 'Email dan password wajib.');

  // AC3 — refuse before touching the password hash, so a blocked email cannot
  // keep burning scrypt cycles.
  const pre = await checkLoginBlock(email);
  if (pre.blocked) return blockedResponse(pre.retryAfter);

  const u = await one('SELECT * FROM users WHERE email = $1', [email]);

  // SSO-only users have no password
  if (u && u.password_hash === 'sso-no-password') {
    return jsonError(401, 'sso_only', 'Akun ini terhubung via Hub. Gunakan tombol Hub.');
  }

  const ok = u ? await verifyPassword(password, u.password_hash) : false;
  if (!ok) {
    // Record the failure even for an unknown email: skipping it would make the
    // 429 arrive only for real accounts, which is the enumeration oracle AC2
    // forbids. AC2's message stays identical either way.
    await recordLoginFailure(email);
    return jsonError(401, 'invalid', 'Email atau password salah.');
  }

  await clearLoginFailures(email);

  const value = makeSessionValue(u.id);
  const res = NextResponse.json({
    ok: true,
    user: { id: u.id, email: u.email, name: u.name, role: u.role, org_id: u.org_id },
    redirectTo: safeNextPath(next),
  });
  res.cookies.set(SESSION_COOKIE, value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}

function blockedResponse(retryAfter: number) {
  const res = jsonError(429, 'rate_limited', 'Terlalu banyak percobaan masuk. Coba lagi nanti.');
  res.headers.set('Retry-After', String(Math.max(1, Math.ceil(retryAfter))));
  return res;
}
