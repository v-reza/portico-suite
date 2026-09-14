import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { one, query } from '@/lib/db';
import { hashPassword, passwordProblem } from '@/lib/password';
import { makeSessionValue, SESSION_COOKIE } from '@/lib/session';
import { jsonError } from '@/lib/auth';

/**
 * POST /api/auth/register — create org + admin user.
 */
export async function POST(req: NextRequest) {
  const { email, password, name, org_name } = await req.json().catch(() => ({}));
  if (!email || !password || !name) {
    return jsonError(400, 'missing', 'Semua field wajib diisi.');
  }
  const problem = passwordProblem(password);
  if (problem) return jsonError(400, 'weak_password', problem);

  const existing = await one('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) return jsonError(400, 'exists', 'Email sudah terdaftar.');

  const orgId = randomBytes(8).toString('hex');
  const userId = randomBytes(8).toString('hex');

  await query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)', [orgId, org_name ?? `${name}'s org`, orgId.slice(0, 12)]);
  await query(
    `INSERT INTO users (id, email, name, org_id, role, password_hash)
     VALUES ($1, $2, $3, $4, 'admin', $5)`,
    [userId, email, name, orgId, await hashPassword(password)],
  );

  const value = makeSessionValue(userId);
  const res = NextResponse.json({ ok: true, user: { id: userId, email, name, role: 'admin', org_id: orgId } });
  res.cookies.set(SESSION_COOKIE, value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}
