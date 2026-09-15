import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { appInOrg } from '@/lib/tenant';

/**
 * PATCH /api/apps/[id] — US-A07 AC1.
 *
 * Name and/or description change and `updated_at` moves. The response carries
 * the updated row back, so the caller shows the fresh "diubah ..." timestamp
 * without a second request and a test can assert the read-back value instead of
 * only the status code.
 *
 * `slug` is deliberately NOT patchable here: the PRD ties it to the public URL
 * (US-A07 AC3 restores "dengan slug yang sama"), and a free-form slug edit would
 * silently break every shared link. Renaming the slug is a separate story.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  const { name, description } = await req.json().catch(() => ({}));
  if (name !== undefined && !String(name).trim()) {
    return jsonError(400, 'invalid_name', 'Nama aplikasi wajib diisi.');
  }

  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (name !== undefined) { updates.push(`name = $${i++}`); values.push(String(name).trim()); }
  if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }

  if (!updates.length) return jsonError(400, 'no_changes', 'Tidak ada perubahan.');
  values.push(id);

  const row = await query(
    `UPDATE apps SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${i}
      RETURNING id, name, slug, description, is_published, archived_at, updated_at`,
    values,
  );
  return NextResponse.json({ app: row.rows[0] });
}

/**
 * US-A07 AC5 — permanent delete, admin only.
 *
 * Everything hanging off the app goes with it: `pages`, `components` (via
 * pages), `workflows`, `workflow_steps` and `app_data_rows` all declare
 * `ON DELETE CASCADE` against `apps(id)`, so one statement removes the lot.
 * The AC also demands the action be recorded, which is the part that was
 * missing: a delete nobody can trace is indistinguishable from data loss.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin.');

  // US-A04 AC6: an app in another workspace answers 403, never a silent delete.
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  // Count before the delete so the log records what was destroyed — after the
  // cascade there is nothing left to count.
  const counts = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM pages WHERE app_id = $1)      AS pages,
       (SELECT COUNT(*)::int FROM components c JOIN pages p ON p.id = c.page_id WHERE p.app_id = $1) AS components,
       (SELECT COUNT(*)::int FROM workflows WHERE app_id = $1)  AS workflows,
       (SELECT COUNT(*)::int FROM app_data_rows WHERE app_id = $1) AS rows`,
    [id],
  );

  await query(
    `INSERT INTO activity_logs (id, org_id, user_id, action, entity_type, entity_id, meta_json)
     VALUES ($1, $2, $3, 'app_deleted', 'app', $4, $5)`,
    [
      randomBytes(8).toString('hex'),
      user.org_id,
      user.id,
      id,
      JSON.stringify({ name: owned.row.name, slug: owned.row.slug, ...counts.rows[0] }),
    ],
  );

  await query('DELETE FROM apps WHERE id = $1', [id]);
  return NextResponse.json({ ok: true, deleted: counts.rows[0] });
}
