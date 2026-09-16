import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { pool, query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { pageInOrg } from '@/lib/tenant';

const ALLOWED_TYPES = new Set(['text','number','email','textarea','select','checkbox','date','file','button','table','heading','divider','rich_text','rating']);

/**
 * US-A09 AC5 — the per-page ceiling. 15 is not invented here: the AI generator
 * already refuses a spec with `page.components.length > 15`, so a hand-built
 * page and a generated one must obey the same limit or the generated path is
 * the only one that is safe.
 */
const MAX_COMPONENTS_PER_PAGE = 15;

/**
 * GET /api/pages/[pageId]/components — list components in order.
 * POST /api/pages/[pageId]/components — add a component.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');

  // US-A04 AC6: a page in another workspace answers 403, not an empty list.
  const owned = await pageInOrg(pageId, user);
  if (!owned.ok) return owned.response;

  const comps = await query('SELECT * FROM components WHERE page_id = $1 ORDER BY order_index', [pageId]);
  return NextResponse.json({ components: comps.rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');
  if (!can(user, ['builder'])) return jsonError(403, 'forbidden', 'Akses ditolak.');

  // US-A04 AC6
  const owned = await pageInOrg(pageId, user);
  if (!owned.ok) return owned.response;

  const { type, config_json, position } = await req.json().catch(() => ({}));
  if (!type || !ALLOWED_TYPES.has(type)) return jsonError(400, 'invalid_type', 'Tipe komponen tidak valid.');

  const id = randomBytes(8).toString('hex');
  const config = config_json && typeof config_json === 'object' && !Array.isArray(config_json) ? config_json : {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // US-A09 AC5 under concurrency: the row lock on `pages` is what makes the
    // COUNT below trustworthy. Without it two simultaneous adds both read 14,
    // both pass the check, and the page ends up with 16 — the exact state the
    // AC forbids. The lock is per page, so unrelated pages never contend.
    await client.query('SELECT id FROM pages WHERE id = $1 FOR UPDATE', [pageId]);

    const counted = await client.query(
      'SELECT COUNT(*)::int AS n FROM components WHERE page_id = $1',
      [pageId],
    );
    const existing: number = counted.rows[0].n;

    if (existing >= MAX_COMPONENTS_PER_PAGE) {
      await client.query('ROLLBACK');
      return jsonError(
        409,
        'page_limit_reached',
        `Batas ${MAX_COMPONENTS_PER_PAGE} komponen per halaman sudah tercapai.`,
      );
    }

    // US-A09 AC1: the component lands at the index it was dropped on, not
    // always at the end. `position` is optional so an append (the previous
    // behaviour, and what the AI generator path does) is unchanged.
    const orderIndex = Number.isInteger(position)
      ? Math.min(Math.max(position as number, 0), existing)
      : existing;

    // Make room, then insert. Both inside the transaction, so a reader never
    // observes two components sharing an order_index.
    await client.query(
      'UPDATE components SET order_index = order_index + 1 WHERE page_id = $1 AND order_index >= $2',
      [pageId, orderIndex],
    );
    await client.query(
      'INSERT INTO components (id, page_id, type, config_json, order_index) VALUES ($1, $2, $3, $4, $5)',
      [id, pageId, type, JSON.stringify(config), orderIndex],
    );
    await client.query('COMMIT');

    return NextResponse.json(
      { component: { id, page_id: pageId, type, config_json: config, order_index: orderIndex } },
      { status: 201 },
    );
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
