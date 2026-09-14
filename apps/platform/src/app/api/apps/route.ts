import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

/**
 * GET /api/apps — list all apps for the user's org.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');

  const apps = await query(
    `SELECT id, name, slug, description, version, is_published, created_at, updated_at
     FROM apps WHERE org_id = $1 ORDER BY created_at DESC`,
    [user.org_id],
  );
  return NextResponse.json({ apps: apps.rows });
}

/**
 * POST /api/apps — create a new app.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');
  if (!can(user, ['admin', 'builder'])) {
    return jsonError(403, 'forbidden', 'Anda tidak punya izin membuat app.');
  }

  const { name, slug, description } = await req.json().catch(() => ({}));
  if (!name) return jsonError(400, 'missing', 'Nama app wajib diisi.');

  const id = randomBytes(8).toString('hex');
  const finalSlug = slug?.trim()?.toLowerCase()?.replace(/[^a-z0-9-]/g, '-') ?? id.slice(0, 8);

  try {
    const result = await query(
      `INSERT INTO apps (id, org_id, name, slug, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, slug, description, version, is_published, created_at`,
      [id, user.org_id, name, finalSlug, description ?? null],
    );
    return NextResponse.json({ app: result.rows[0] }, { status: 201 });
  } catch (e: any) {
    if (e.code === '23505') {
      return jsonError(409, 'exists', 'Slug sudah dipakai.');
    }
    throw e;
  }
}
