import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { appInOrg } from '@/lib/tenant';

/**
 * US-A07 AC2 — archive an app.
 *
 * Archiving is a state change, not a delete: the row, its pages, components,
 * workflows and data rows all stay. What changes is that the app disappears
 * from the main list and its public link stops resolving.
 *
 * US-A07 AC4 — a `viewer` must be refused **here**, on the server. Hiding the
 * button is not the requirement; the endpoint has to answer 403.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6: ownership is checked before any state changes.
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  const row = await query(
    `UPDATE apps SET archived_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, slug, archived_at`,
    [id],
  );
  return NextResponse.json({ app: row.rows[0] });
}
