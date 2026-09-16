import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { PublicAppForm } from '@/components/PublicAppForm';

export const dynamic = 'force-dynamic';

/**
 * `/p/[slug]` — the public link itself (US-A08 AC1/AC2/AC3, A-PRD §4 "Form
 * publik: render aplikasi yang dipublikasikan tanpa login").
 *
 * The API route at `/api/public/apps/[slug]` is the machine-readable half of the
 * same rule; this page is the half the story actually describes — "muncul
 * halaman", not "muncul JSON". Three states, and the difference matters:
 *
 *   published        -> the app's form
 *   draft (AC1/AC3)  -> the "belum dipublikasikan" page, HTTP 200 with that
 *                       content. A draft is not missing, it is unpublished;
 *                       answering 404 would make the page lie and would tell the
 *                       visitor the slug does not exist.
 *   unknown/archived -> 404. Archiving (US-A07 AC2) stops the link working, and
 *                       a slug nobody holds must not confirm itself.
 *
 * No session: this is the one page a visitor without an account opens.
 */
export default async function PublicAppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // UNIQUE(org_id, slug) means a slug is only unique inside a workspace, and the
  // public URL carries no workspace. Two rows is an ambiguous link: answer 404
  // rather than serving one workspace's form under another's URL (the leak
  // US-A04 AC6 exists to prevent).
  const found = await query(
    'SELECT id, name, slug, description, is_published, archived_at FROM apps WHERE slug = $1 LIMIT 2',
    [slug],
  );
  const app = found.rows.length === 1 ? found.rows[0] : null;
  if (!app || app.archived_at) notFound();

  if (!app.is_published) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--surface-page)] p-4">
        <div className="w-full max-w-[380px] bg-[var(--surface-panel)] rounded-lg border border-[var(--border-standard)] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.08)] p-6 text-center">
          {/* Empty-state pattern lifted from the export
              (portico_helpdesk_ticket_list_empty_state): a 40px
              `--surface-hover` circle holding a 20px inline SVG at
              `--text-quaternary`. Inline SVG rather than a Unicode glyph or a
              Material Symbols ligature, for the same reason `@portico/ui/icons`
              gives: a glyph the font does not carry renders as tofu, and a
              ligature renders as its own word when the webfont fails. */}
          <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-quaternary)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.7a2 2 0 0 0 2.8 2.8" />
              <path d="M9.4 5.5A9.7 9.7 0 0 1 12 5.2c4.4 0 8 3.3 9.5 6.8a12.4 12.4 0 0 1-2.6 3.7" />
              <path d="M6.2 6.9A12.9 12.9 0 0 0 2.5 12c1.5 3.5 5.1 6.8 9.5 6.8a9.6 9.6 0 0 0 4-.86" />
            </svg>
          </div>
          <h1 className="text-[1.25rem] leading-[1.33] font-semibold text-[var(--text-primary)] tracking-[-0.24px]">
            Belum dipublikasikan
          </h1>
          <p className="mt-2 text-[0.813rem] text-[var(--text-secondary)]">
            Aplikasi ini belum dipublikasikan oleh pemiliknya, jadi form-nya belum bisa dipakai.
          </p>
        </div>
      </main>
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

  return (
    <PublicAppForm
      app={{ name: app.name, slug: app.slug, description: app.description }}
      pages={pages.rows}
    />
  );
}
