import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { appInOrg } from '@/lib/tenant';

/**
 * GET /api/apps/[id]/pages — list pages in order.
 * POST /api/apps/[id]/pages — create a page.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');

  // US-A04 AC6
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  const pages = await query('SELECT * FROM pages WHERE app_id = $1 ORDER BY order_index', [id]);
  return NextResponse.json({ pages: pages.rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6
  const owned = await appInOrg(id, user);
  if (!owned.ok) return owned.response;

  const { name, route } = await req.json().catch(() => ({}));
  if (!name) return jsonError(400, 'missing', 'Nama halaman wajib.');

  const pageId = randomBytes(8).toString('hex');
  const count = await query('SELECT COUNT(*) FROM pages WHERE app_id = $1', [id]);
  const orderIndex = parseInt(count.rows[0].count) || 0;

  await query(
    'INSERT INTO pages (id, app_id, name, route, order_index) VALUES ($1, $2, $3, $4, $5)',
    [pageId, id, name, route || '/', orderIndex],
  );
  return NextResponse.json({ page: { id: pageId, app_id: id, name, route: route || '/', order_index: orderIndex } }, { status: 201 });
}
