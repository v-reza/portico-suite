import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { workflowInOrg } from '@/lib/tenant';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6
  const owned = await workflowInOrg(id, user);
  if (!owned.ok) return owned.response;

  await query('UPDATE workflows SET active = NOT active WHERE id = $1', [id]);
  return NextResponse.json({ active: !owned.row.active });
}
