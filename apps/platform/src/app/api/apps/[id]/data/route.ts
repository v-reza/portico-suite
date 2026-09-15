import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { appInOrg } from '@/lib/tenant';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');

  // US-A04 AC6
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  const rows = await query('SELECT * FROM app_data_rows WHERE app_id = $1 ORDER BY created_at DESC', [id]);
  return NextResponse.json({ rows: rows.rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  const { row_json } = await req.json().catch(() => ({}));
  if (!row_json) return jsonError(400, 'missing', 'Data wajib.');

  const rowId = randomBytes(8).toString('hex');
  await query(
    'INSERT INTO app_data_rows (id, app_id, row_json, created_by) VALUES ($1, $2, $3, $4)',
    [rowId, id, JSON.stringify(row_json), user.id],
  );
  return NextResponse.json({ row: { id: rowId, row_json } }, { status: 201 });
}
