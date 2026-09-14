import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

const ALLOWED_TYPES = new Set(['text','number','email','textarea','select','checkbox','date','file','button','table','heading','divider','rich_text','rating']);

/**
 * GET /api/pages/[pageId]/components — list components in order.
 * POST /api/pages/[pageId]/components — add a component.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{pageId: string }> }) {
  const { pageId } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  const comps = await query('SELECT * FROM components WHERE page_id = $1 ORDER BY order_index', [pageId]);
  return NextResponse.json({ components: comps.rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  const page = await query('SELECT id FROM pages WHERE id = $1', [pageId]);
  if (!page.rows.length) return jsonError(404, 'not_found', 'Halaman tidak ditemukan.');

  const { type, config_json } = await req.json().catch(() => ({}));
  if (!type || !ALLOWED_TYPES.has(type)) return jsonError(400, 'invalid_type', 'Tipe komponen tidak valid.');

  const id = randomBytes(8).toString('hex');
  const count = await query('SELECT COUNT(*) FROM components WHERE page_id = $1', [pageId]);
  const orderIndex = parseInt(count.rows[0].count) || 0;

  await query(
    'INSERT INTO components (id, page_id, type, config_json, order_index) VALUES ($1, $2, $3, $4, $5)',
    [id, pageId, type, JSON.stringify(config_json || {}), orderIndex]
  );
  return NextResponse.json({ component: { id, page_id: pageId, type, config_json: config_json || {}, order_index: orderIndex } }, { status: 201 });
}
