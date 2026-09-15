import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { appInOrg } from '@/lib/tenant';

/**
 * US-A07 AC3 — restore an archived app.
 *
 * The slug is never touched by archiving, so restoring brings the public link
 * back on the same slug with its pages and data rows untouched.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  const row = await query(
    `UPDATE apps SET archived_at = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, slug, archived_at`,
    [id],
  );
  return NextResponse.json({ app: row.rows[0] });
}
