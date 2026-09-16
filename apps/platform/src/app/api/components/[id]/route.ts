import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { componentInOrg } from '@/lib/tenant';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6: refuse before the DELETE, so a guessed id cannot remove a row
  // from another workspace.
  const owned = await componentInOrg(id, user);
  if (!owned.ok) return owned.response;

  await query('DELETE FROM components WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}

/**
 * US-A09 AC4 — the inspector edits one property at a time (label, then
 * placeholder, then wajib-isi). This MERGES the patch into the stored config
 * rather than replacing it, so the three edits are independent: with a
 * whole-object replace, a client that sends the config it last rendered
 * overwrites a newer field whenever two PATCHes overlap, and the user watches
 * a setting they just changed silently revert.
 *
 * `||` is jsonb "shallow merge" — keys present in the patch win, keys absent
 * from it are left alone.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6
  const owned = await componentInOrg(id, user);
  if (!owned.ok) return owned.response;

  const { config_json } = await req.json().catch(() => ({}));
  if (!config_json || typeof config_json !== 'object' || Array.isArray(config_json)) {
    return jsonError(400, 'invalid_config', 'Konfigurasi tidak valid.');
  }

  const updated = await query(
    'UPDATE components SET config_json = config_json || $1::jsonb WHERE id = $2 RETURNING config_json',
    [JSON.stringify(config_json), id],
  );
  return NextResponse.json({ ok: true, config_json: updated.rows[0].config_json });
}
