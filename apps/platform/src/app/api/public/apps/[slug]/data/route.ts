import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';

/**
 * POST /api/public/apps/[slug]/data — US-A08 AC5.
 *
 * Unauthenticated form submission for a published app. A visitor can send data
 * but cannot read what was submitted before (no GET on this path — the
 * authenticated GET lives at `/api/apps/[id]/data` and requires a session).
 *
 * Three answers:
 *   404  — slug unknown or archived
 *   403  — app is a draft (same as the public GET above, US-A08 AC1)
 *   201  — data accepted
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const found = await query(
    'SELECT id, name, is_published, archived_at FROM apps WHERE slug = $1 LIMIT 2',
    [slug],
  );

  if (found.rows.length !== 1 || found.rows[0].archived_at) {
    return NextResponse.json({ error: 'not_found', message: 'Tautan tidak ditemukan.' }, { status: 404 });
  }

  const app = found.rows[0];

  // US-A08 AC1 — draft is not accessible via the public link.
  if (!app.is_published) {
    return NextResponse.json(
      { error: 'unpublished', published: false, message: 'Aplikasi ini belum dipublikasikan.' },
      { status: 403 },
    );
  }

  const { row_json } = await req.json().catch(() => ({}));
  if (!row_json || typeof row_json !== 'object') {
    return NextResponse.json({ error: 'missing_data', message: 'Data wajib dikirim.' }, { status: 400 });
  }

  const rowId = randomBytes(8).toString('hex');
  await query(
    'INSERT INTO app_data_rows (id, app_id, row_json, created_by) VALUES ($1, $2, $3, NULL)',
    [rowId, app.id, JSON.stringify(row_json)],
  );

  // US-A08 AC5 — only the row id is returned; no other data is leaked.
  return NextResponse.json({ ok: true, id: rowId }, { status: 201 });
}