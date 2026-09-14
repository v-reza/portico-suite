import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { pool } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';

/**
 * POST /api/pages/[pageId]/duplicate — deep-copy a page and its components.
 *
 * Whole operation is one transaction: a copy that fails part-way must leave no
 * page and no component behind (US-A28 AC4), so every insert shares the same
 * client and a throw rolls all of it back.
 */

// Two clicks on "Duplikat" land within a second of each other (US-A28 AC6).
// Inside this window a second request is answered with the copy the first one
// already made instead of creating another page.
const DEDUPE_WINDOW = '10 seconds';

async function uniqueRoute(
  client: { query: (t: string, p?: any[]) => Promise<{ rows: any[] }> },
  appId: string,
  sourceRoute: string,
): Promise<string> {
  // US-A28 AC3: `daftar` -> `daftar-copy`, then `daftar-copy-2`, `-3`, …
  // Uniqueness is per app (US-A11 AC5 scopes route collisions to one app).
  // A page sitting at the root has no name to suffix, so it copies to `/copy`.
  const root = sourceRoute && sourceRoute !== '/' ? sourceRoute.replace(/\/+$/, '') : '';
  let n = 2;
  let candidate = root ? `${root}-copy` : '/copy';
  for (;;) {
    const hit = await client.query('SELECT 1 FROM pages WHERE app_id = $1 AND route = $2', [
      appId,
      candidate,
    ]);
    if (!hit.rows.length) return candidate;
    candidate = root ? `${root}-copy-${n}` : `/copy-${n}`;
    n += 1;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk.');

  const srcRes = await pool.query(
    `SELECT p.id, p.app_id, p.name, p.route, a.org_id
       FROM pages p JOIN apps a ON a.id = p.app_id
      WHERE p.id = $1`,
    [pageId],
  );
  const src = srcRes.rows[0];
  if (!src) return jsonError(404, 'not_found', 'Halaman tidak ditemukan.');

  // US-A28 AC5: enforced on the server, not by hiding the button. Both the role
  // and the workspace membership are checked — a viewer from another org gets
  // 403 and no row is ever written.
  if (!can(user, ['builder']) || src.org_id !== user.org_id) {
    return jsonError(403, 'forbidden', 'Akses ditolak.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialise concurrent duplicates of the same page so the dedupe check
    // below cannot be raced by two requests reading "no copy yet" at once.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [pageId]);

    const copyName = `${src.name} (copy)`; // US-A28 AC1
    const dup = await client.query(
      `SELECT id, name, route, order_index FROM pages
        WHERE app_id = $1 AND name = $2 AND created_at > now() - interval '${DEDUPE_WINDOW}'
        ORDER BY created_at DESC LIMIT 1`,
      [src.app_id, copyName],
    );
    if (dup.rows.length) {
      await client.query('COMMIT');
      return NextResponse.json({ page: dup.rows[0], deduped: true }, { status: 200 });
    }

    const route = await uniqueRoute(client, src.app_id, src.route);
    const newPageId = randomBytes(8).toString('hex');
    const countRes = await client.query(
      'SELECT COUNT(*)::int AS n FROM pages WHERE app_id = $1',
      [src.app_id],
    );
    await client.query(
      `INSERT INTO pages (id, app_id, name, route, order_index) VALUES ($1, $2, $3, $4, $5)`,
      [newPageId, src.app_id, copyName, route, countRes.rows[0].n],
    );

    // US-A28 AC1/AC2: deep copy. Parents are inserted before their children and
    // every child's parent_id is remapped to the COPY's row, so the two trees
    // share no rows — editing one can never touch the other.
    const compRes = await client.query(
      `SELECT id, type, config_json, order_index, parent_id
         FROM components WHERE page_id = $1 ORDER BY order_index`,
      [pageId],
    );
    const idMap = new Map<string, string>();
    let pending = compRes.rows;
    let guard = pending.length + 1;
    while (pending.length) {
      if (guard-- <= 0) throw new Error('deep copy did not converge');
      const ready = pending.filter((r: any) => !r.parent_id || idMap.has(r.parent_id));
      if (!ready.length) {
        // A child whose parent is not on this page means the source tree is
        // broken. Copying the rest would persist a half tree, which AC4
        // forbids — fail the whole transaction instead.
        throw new Error('struktur komponen rusak: induk tidak ada di halaman ini');
      }
      for (const r of ready) {
        const newId = randomBytes(8).toString('hex');
        await client.query(
          `INSERT INTO components (id, page_id, type, config_json, order_index, parent_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            newId,
            newPageId,
            r.type,
            JSON.stringify(r.config_json ?? {}),
            r.order_index,
            r.parent_id ? idMap.get(r.parent_id) : null,
          ],
        );
        idMap.set(r.id, newId);
      }
      pending = pending.filter((r: any) => !idMap.has(r.id));
    }

    await client.query('COMMIT');
    return NextResponse.json(
      {
        page: { id: newPageId, app_id: src.app_id, name: copyName, route, order_index: countRes.rows[0].n },
        copiedComponents: idMap.size,
      },
      { status: 201 },
    );
  } catch {
    await client.query('ROLLBACK');
    return jsonError(500, 'copy_failed', 'Gagal menduplikat halaman. Tidak ada perubahan yang tersimpan.');
  } finally {
    client.release();
  }
}
