import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { one, pool } from '@/lib/db';
import { hashPassword, passwordProblem } from '@/lib/password';
import { makeSessionValue, SESSION_COOKIE } from '@/lib/session';
import { jsonError } from '@/lib/auth';
import { randomSlug, uniqueSlug } from '@/lib/slug';

const MAX_SLUG_ATTEMPTS = 5;

/** 23505 = unique_violation. `constraint` names which one lost the race. */
function uniqueViolation(e: unknown): string | null {
  const err = e as { code?: string; constraint?: string };
  return err?.code === '23505' ? (err.constraint ?? '') : null;
}

/**
 * POST /api/auth/register — create a workspace plus its first `admin`
 * (US-A01).
 *
 * US-A01 AC4: the workspace and its admin are written in ONE transaction, so a
 * failure on the second statement cannot leave a workspace with no owner. The
 * UNIQUE constraints are the authority under concurrency; the retry loop covers
 * two registrations that picked the same slug at the same time.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as Record<string, string>);
  const name = (body.name ?? '').trim();
  const workspaceName = (body.workspace_name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const confirm = body.confirm ?? '';

  if (!name) return jsonError(400, 'missing', 'Nama wajib diisi.');
  // AC1 names the workspace explicitly — without it there is nothing to create.
  if (!workspaceName) return jsonError(400, 'missing', 'Nama workspace wajib diisi.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonError(400, 'email_invalid', 'Format email tidak valid.');
  }
  const problem = passwordProblem(password);
  if (problem) return jsonError(400, 'weak_password', problem);
  if (password !== confirm) {
    return jsonError(400, 'password_mismatch', 'Konfirmasi password tidak sama.');
  }

  // AC2: same answer for every casing of an address already in use.
  const existing = await one('SELECT id FROM users WHERE lower(email) = $1', [email]);
  if (existing) return jsonError(409, 'exists', 'Email sudah terdaftar.');

  const client = await pool.connect();
  try {
    // Flips to a random suffix once the deterministic slug has lost the race
    // MAX_SLUG_ATTEMPTS times. Contention must never reach the client as a 500:
    // `randomSlug` is a fresh value, so the next INSERT is not competing.
    let fallback = false;
    for (let attempt = 1; ; attempt++) {
      await client.query('BEGIN');
      try {
        const orgId = randomBytes(8).toString('hex');
        const userId = randomBytes(8).toString('hex');
        const slug = fallback
          ? randomSlug(workspaceName)
          : await uniqueSlug((text, params) => client.query(text, params as never), workspaceName);

        await client.query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)', [
          orgId,
          workspaceName,
          slug,
        ]);
        await client.query(
          `INSERT INTO users (id, email, name, org_id, role, password_hash)
           VALUES ($1, $2, $3, $4, 'admin', $5)`,
          [userId, email, name, orgId, await hashPassword(password)],
        );
        await client.query('COMMIT');

        const value = makeSessionValue(userId);
        const res = NextResponse.json(
          {
            ok: true,
            user: { id: userId, email, name, role: 'admin', org_id: orgId },
            workspace: { id: orgId, name: workspaceName, slug },
          },
          { status: 201 },
        );
        res.cookies.set(SESSION_COOKIE, value, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
        return res;
      } catch (e) {
        await client.query('ROLLBACK');
        const constraint = uniqueViolation(e);
        // AC2 under a race: the other request took the email first.
        if (constraint?.includes('email')) {
          return jsonError(409, 'exists', 'Email sudah terdaftar.');
        }
        if (constraint?.includes('slug')) {
          fallback = attempt >= MAX_SLUG_ATTEMPTS;
          continue;
        }
        throw e;
      }
    }
  } finally {
    client.release();
  }
}
