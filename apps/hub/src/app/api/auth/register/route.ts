import { NextResponse, type NextRequest } from 'next/server';
import { one, query } from '@/lib/db';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/password';
import { audit } from '@/lib/audit';
import { newSessionId, SESSION_COOKIE, sessionCookieOptions, signSessionId, SESSION_TTL_MS } from '@/lib/session';
import { jsonError, sameOrigin } from '@/lib/auth';

/**
 * POST /api/auth/register — create a Hub account.
 *
 * Hub accounts are identity only: no app membership is granted here (that is
 * US-M10 AC1 — the user lands in the app without membership and is routed to
 * the invite/create-workspace path).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'bad_origin', 'Origin tidak dikenal.');

  let body: { name?: string; email?: string; password?: string; confirm?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'bad_json', 'Body bukan JSON.');
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const confirm = body.confirm ?? '';

  if (!name) return jsonError(400, 'name_required', 'Nama wajib diisi.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonError(400, 'email_invalid', 'Format email tidak valid.');
  }
  const pwProblem = passwordProblem(password);
  if (pwProblem) return jsonError(400, 'password_weak', pwProblem);
  if (password !== confirm) {
    return jsonError(400, 'password_mismatch', 'Konfirmasi password tidak sama.');
  }

  const existing = await one<{ id: string }>('SELECT id FROM hub_users WHERE email = $1', [email]);
  if (existing) {
    // Same message as success would be better for enumeration-resistance, but
    // the register screen is a public demo; a clear error is the better UX and
    // the login page already reveals account existence implicitly.
    return jsonError(409, 'email_taken', 'Email ini sudah terdaftar.');
  }

  const row = await one<{ id: string; email: string; display_name: string }>(
    `INSERT INTO hub_users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name`,
    [email, await hashPassword(password), name],
  );
  if (!row) return jsonError(500, 'insert_failed', 'Gagal membuat akun.');

  // Register signs you in immediately — same session mechanics as login.
  const sid = newSessionId();
  await query(
    'INSERT INTO hub_sessions (id, user_id, expires_at) VALUES ($1, $2, now() + ($3 || \' milliseconds\')::interval)',
    [sid, row.id, String(SESSION_TTL_MS)],
  );
  await audit(row.id, 'user.register', row.email, { via: 'hub' });

  const res = NextResponse.json({ ok: true, user: { id: row.id, email: row.email, name: row.display_name } });
  res.cookies.set(SESSION_COOKIE, signSessionId(sid), sessionCookieOptions());
  return res;
}

/**
 * GET /api/auth/register — the policy the UI must show, read from the one
 * implementation instead of being duplicated as copy in the page.
 */
export async function GET() {
  return NextResponse.json({
    policy: {
      minLength: 8,
      requiresLetter: true,
      requiresDigit: true,
      helper: 'Minimal 8 karakter dengan kombinasi huruf dan angka.',
    },
    verification: { emailVerification: false, note: 'Portofolio demo: email tidak diverifikasi.' },
  });
}

/** Used by the register form to warn before submit, without creating anything. */
export async function PUT(req: NextRequest) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'bad_json', 'Body bukan JSON.');
  }
  const problem = passwordProblem(body.password ?? '');
  return NextResponse.json({ ok: !problem, problem });
}
