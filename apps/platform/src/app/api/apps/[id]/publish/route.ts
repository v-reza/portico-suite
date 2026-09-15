import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { appInOrg } from '@/lib/tenant';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['admin'])) return jsonError(403, 'forbidden', 'Hanya admin.');

  // US-A04 AC6: check ownership before touching state, so a cross-workspace
  // request cannot flip `is_published` on someone else's app.
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  await query('UPDATE apps SET is_published = NOT is_published WHERE id = $1', [id]);
  return NextResponse.json({ is_published: !owned.row.is_published });
}
