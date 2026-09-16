import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query, one, pool } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

/**
 * PATCH /api/orgs/members/[id] — change a member's role (US-A03 AC3 / US-A04).
 *
 * AC4: the last admin cannot be demoted.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin yang bisa mengubah peran.');

  // Target must exist in OUR org
  const target = await one('SELECT id, role FROM users WHERE id = $1 AND org_id = $2', [id, user.org_id]);
  if (!target) return jsonError(404, 'not_found', 'Anggota tidak ditemukan.');

  // AC4: cannot demote your own role if you are the only admin left
  if (id === user.id) {
    return jsonError(400, 'self_demote', 'Anda tidak bisa mengubah peran sendiri.');
  }

  const { role } = await req.json().catch(() => ({}));
  if (!['admin', 'builder', 'viewer'].includes(role)) {
    return jsonError(400, 'invalid_role', 'Peran tidak valid.');
  }

  const before = target.role;
  await query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);

  // Log the change
  await query(
    `INSERT INTO activity_logs (id, org_id, user_id, action, entity_type, entity_id, meta_json)
     VALUES ($1, $2, $3, 'role_changed', 'user', $4, $5)`,
    [randomBytes(8).toString('hex'), user.org_id, user.id, id,
     JSON.stringify({ from: before, to: role })],
  );

  return NextResponse.json({ ok: true, from: before, to: role });
}

/**
 * DELETE /api/orgs/members/[id] — remove a member from the org (US-A03).
 *
 * AC4: the last admin cannot be removed.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin yang bisa menghapus anggota.');

  const target = await one('SELECT id, role FROM users WHERE id = $1 AND org_id = $2', [id, user.org_id]);
  if (!target) return jsonError(404, 'not_found', 'Anggota tidak ditemukan.');

  if (id === user.id) {
    return jsonError(400, 'self_remove', 'Anda tidak bisa menghapus diri sendiri.');
  }

  // Three tables hold a foreign key to users(id), so the row cannot be deleted
  // until each is dealt with — otherwise the DELETE raises 23503 and the whole
  // revocation 500s:
  //   app_data_rows.created_by  -> reassigned to the admin performing the
  //                                removal, so no row is left ownerless.
  //   activity_logs.user_id     -> nulled rather than deleted: the audit entry
  //                                itself is worth keeping, and the removed
  //                                member is still named by entity_id/org_id.
  //   invitations.created_by    -> nulled; the invite is a historical record.
  // Do it in one transaction, or a failure halfway leaves the member half gone.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE app_data_rows SET created_by = $1 WHERE created_by = $2', [user.id, id]);
    await client.query('UPDATE activity_logs SET user_id = NULL WHERE user_id = $1', [id]);
    await client.query('UPDATE invitations SET created_by = NULL WHERE created_by = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    await client.query(
      `INSERT INTO activity_logs (id, org_id, user_id, action, entity_type, entity_id, meta_json)
       VALUES ($1, $2, $3, 'member_removed', 'user', $4, '{}'::jsonb)`,
      [randomBytes(8).toString('hex'), user.org_id, user.id, id],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true });
}