'use client';

import { useState } from 'react';
import { ComponentPreview, INPUT_TYPES, typeLabel } from './ComponentPreview';

interface Component { id: string; type: string; config_json: Record<string, any> | null; order_index: number }
interface Page { id: string; name: string; route: string; order_index: number; components: Component[] }

/**
 * PublicAppForm — the visitor-facing side of a published app (US-A08 AC1/AC2/AC3
 * and the "Form publik" rows of A-PRD §4).
 *
 * The Stitch export has no screen for this page: the public link is the one
 * surface a visitor sees and the mock set never drew it. It is therefore
 * composed from the tokens and patterns already on the login card — the same
 * `--surface-page` background, the same 380px `--surface-panel` card, the same
 * hairline border and card shadow, the same 12/13px type tiers and 38px
 * controls. Nothing new is introduced, and the decision is recorded here rather
 * than left implicit.
 *
 * Submit posts to `/api/public/apps/[slug]/data`, the unauthenticated path
 * (US-A08 AC5): the visitor can send and nothing else. There is deliberately no
 * read of previously submitted rows anywhere in this component.
 */
export function PublicAppForm({
  app,
  pages,
}: {
  app: { name: string; slug: string; description: string | null };
  pages: Page[];
}) {
  const [activePageId, setActivePageId] = useState(pages[0]?.id ?? '');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const activePage = pages.find((p) => p.id === activePageId);
  const components = [...(activePage?.components ?? [])].sort((a, b) => a.order_index - b.order_index);

  /**
   * The builder's `button` component IS the submit control — the reference
   * `platform_app_builder` draws exactly one button per form ("Kirim Dokumen
   * Pendaftaran"). Rendering the component AND a separate form button would put
   * two submits on the page, which the design never shows. The extra control is
   * only a fallback for a form whose author never added a button.
   */
  const hasSubmitButton = components.some((c) => c.type === 'button');

  /** Field key for a component: its label, which is what the builder shows. */
  function fieldName(c: Component) {
    const cfg = (c.config_json ?? {}) as Record<string, any>;
    return cfg.label ?? cfg.text ?? typeLabel(c.type);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Uncontrolled inputs read through FormData: the inputs are rendered by
    // ComponentPreview, so a controlled copy would duplicate that state and
    // drift from what the visitor actually sees.
    //
    // The element is captured before the first `await`: React nulls
    // `currentTarget` once the handler yields, so reading `e.currentTarget`
    // after the fetch threw "Terjadi kesalahan jaringan" on every submit.
    const form = e.currentTarget;
    const fd = new FormData(form);
    const row: Record<string, string> = {};
    for (const c of components) {
      if (!INPUT_TYPES.includes(c.type)) continue;
      const v = fd.get(`f_${c.id}`);
      if (typeof v === 'string' && v.trim() !== '') row[fieldName(c)] = v;
    }
    if (!Object.keys(row).length) {
      setStatus('failed');
      setMessage('Isi minimal satu field sebelum mengirim.');
      return;
    }

    setStatus('sending');
    try {
      const r = await fetch(`/api/public/apps/${app.slug}/data`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ row_json: row }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus('failed');
        // AC1/AC3: an app unpublished while this tab was open answers 403, and
        // the visitor is told that rather than shown a generic failure.
        setMessage(data?.error === 'unpublished'
          ? 'Aplikasi ini sudah tidak dipublikasikan lagi.'
          : (data?.message ?? 'Gagal mengirim. Coba lagi.'));
        return;
      }
      setStatus('sent');
      setMessage('Data berhasil dikirim.');
      form.reset();
    } catch {
      setStatus('failed');
      setMessage('Terjadi kesalahan jaringan.');
    }
  }

  return (
    <main className="min-h-screen flex items-start justify-center bg-[var(--surface-page)] p-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="bg-[var(--surface-panel)] rounded-lg border border-[var(--border-standard)] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.08)] p-6">
          <header className="mb-5">
            <h1 className="text-[1.25rem] leading-[1.33] font-semibold text-[var(--text-primary)] tracking-[-0.24px]">
              {app.name}
            </h1>
            {app.description && (
              <p className="mt-1 text-[0.813rem] text-[var(--text-secondary)]">{app.description}</p>
            )}
          </header>

          {pages.length > 1 && (
            <nav className="flex items-center gap-1 border-b border-[var(--border-subtle)] mb-5">
              {pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePageId(p.id)}
                  className={[
                    'h-9 px-3 -mb-px border-b-2 text-[0.813rem] font-medium transition-colors',
                    p.id === activePageId
                      ? 'border-[var(--accent)] text-[var(--text-primary)]'
                      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                  ].join(' ')}
                >
                  {p.name}
                </button>
              ))}
            </nav>
          )}

          {status === 'sent' ? (
            <div role="status" className="p-3 rounded-md bg-[var(--surface-hover)] text-[var(--text-secondary)] text-[0.813rem]">
              {message}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {components.map((c) => (
                <ComponentPreview key={c.id} comp={c} mode="form" name={`f_${c.id}`} />
              ))}
              {!components.length && (
                <p className="text-[0.813rem] text-[var(--text-tertiary)]">
                  Halaman ini belum punya komponen.
                </p>
              )}

              {status === 'failed' && message && (
                <div role="alert" className="p-3 rounded-md bg-[var(--critical-tint)] text-[var(--critical)] text-[0.813rem]">
                  {message}
                </div>
              )}

              {!hasSubmitButton && (
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full h-10 px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[0.813rem] font-medium rounded-[6px] transition-colors flex items-center justify-center disabled:opacity-60"
                >
                  {status === 'sending' ? 'Mengirim...' : 'Kirim'}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
