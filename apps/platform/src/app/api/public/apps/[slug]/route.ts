import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';

/**
 * Public resolver for an app's slug — the target of the "tautan publik" the PRD
 * talks about (`app.portico.internal/<slug>`, the prefix the Stitch reference
 * `platform_pengaturan_aplikasi_sumber_data` draws on the slug field).
 *
 * No session: this is the one read path a visitor without an account uses.
 * Three distinct answers, and the difference between them matters:
 *
 *   unknown / ambiguous slug -> 404 (nothing to learn)
 *   US-A07 AC2/AC3 archived  -> 404. Archiving stops the public link working;
 *                               restoring makes the same slug resolve again.
 *   US-A08 AC1 draft         -> 403 with `published: false`, i.e. the "belum
 *                               dipublikasikan" state. A draft is not missing,
 *                               it is unpublished — collapsing the two into a
 *                               404 would make the page lie.
 *
 * `apps` is UNIQUE(org_id, slug), so a slug is only unique *within* a workspace
 * (A-PRD §5). Two workspaces can therefore hold the same slug, and the public
 * URL has no workspace in it. The lookup takes at most two rows and answers 404
 * when two workspaces collide, rather than picking one: a coin-flip would serve
 * workspace X's form under workspace Y's link, which is the cross-tenant leak
 * US-A04 AC6 exists to prevent. Making the slug globally unique is a schema
 * decision that belongs to whoever owns the public-URL story.
 *
 * Pages and components are only serialised on the 200 path, so a draft or an
 * archived app leaks neither its name nor its content.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const found = await query(
    'SELECT id, name, slug, description, is_published, archived_at FROM apps WHERE slug = $1 LIMIT 2',
    [slug],
  );
  const app = found.rows.length === 1 ? found.rows[0] : null;

  // Archived (US-A07 AC2/AC3), unknown and ambiguous share the answer on purpose.
  if (!app || app.archived_at) {
    return NextResponse.json({ error: 'not_found', message: 'Tautan tidak ditemukan.' }, { status: 404 });
  }

  if (!app.is_published) {
    return NextResponse.json(
      { error: 'unpublished', published: false, message: 'Aplikasi ini belum dipublikasikan.' },
      { status: 403 },
    );
  }

  const pages = await query(
    `SELECT p.id, p.name, p.route, p.order_index,
            COALESCE(
              (SELECT json_agg(c ORDER BY c.order_index)
                 FROM components c WHERE c.page_id = p.id), '[]'::json) AS components
       FROM pages p WHERE p.app_id = $1 ORDER BY p.order_index`,
    [app.id],
  );

  return NextResponse.json({
    app: { name: app.name, slug: app.slug, description: app.description, published: true },
    pages: pages.rows,
  });
}
