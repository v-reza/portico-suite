'use client';

/**
 * AppView — the full-screen app BUILDER, cloned from the Stitch reference
 * `platform_app_builder`. This is NOT a PlatformShell page: the builder owns
 * a 56px toolbar + a 3-column workspace (palette 220 / canvas dot-grid /
 * inspector 280). Component edits happen visually on the canvas; the inspector
 * shows type-specific properties for the selected component.
 *
 * The list/console screens use PlatformShell; the builder deliberately does
 * not (see reference). Keep that separation.
 */
import { Fragment, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconSparkles, IconTrash, IconChevronRight } from '@portico/ui/icons';
import { ComponentPreview, typeLabel, type PreviewComponent } from './ComponentPreview';
import { Modal } from '@portico/ui/modal';

// ---- types ---------------------------------------------------------------
interface App { id: string; name: string; slug: string; description: string | null; is_published: boolean }
interface Component extends PreviewComponent { page_id: string; order_index: number }
interface Page { id: string; app_id: string; name: string; route: string; order_index: number; components: Component[] }
interface WorkflowStep { id: string; workflow_id: string; action_type: string; config_json: any; step_order: number; on_error: string }
interface Workflow { id: string; app_id: string; name: string; trigger_type: string; config_json: any; active: boolean; steps: WorkflowStep[] }

// Palette sections — match the Stitch reference exactly (label + glyph).
const PALETTE: { section: string; items: { type: string; label: string }[] }[] = [
  {
    section: 'DASAR',
    items: [
      { type: 'textarea', label: 'Teks' },
      { type: 'heading', label: 'Judul' },
      { type: 'button', label: 'Tombol' },
      { type: 'image', label: 'Gambar' },
      { type: 'divider', label: 'Pemisah' },
    ],
  },
  {
    section: 'INPUT',
    items: [
      { type: 'text', label: 'Input teks' },
      { type: 'select', label: 'Dropdown' },
      { type: 'date', label: 'Tanggal' },
    ],
  },
  {
    section: 'TAMPILAN',
    items: [
      { type: 'rich_text', label: 'Kartu' },
      { type: 'table', label: 'Tabel' },
    ],
  },
];

/**
 * US-A09 AC1/AC3 — the drag payload. A dedicated MIME type is what separates a
 * component drag from any other drag in the page, so the canvas can accept one
 * and ignore the rest. `text/plain` would let an arbitrary text selection count
 * as a drop, which is exactly the "komponen nyasar" the AC forbids.
 */
const DRAG_MIME = 'application/x-portico-component';

/**
 * US-A09 AC5 — mirrors `MAX_COMPONENTS_PER_PAGE` in the components route. The
 * server is the authority (it answers 409); this copy only lets the palette
 * explain the limit before the request is made.
 */
const MAX_COMPONENTS_PER_PAGE = 15;

/**
 * US-A09 AC4 — the types whose config carries a label / placeholder /
 * wajib-isi. A heading has `text`, a button has `label` and a variant; showing
 * a placeholder box for those would be an invented property.
 */
const FIELD_TYPES = new Set(['text', 'email', 'number', 'textarea', 'select', 'date']);

/** AC4 — read one config field, falling back to the label the canvas shows. */
function cfgField(comp: Component, key: 'label' | 'placeholder'): string {
  const cfg = (comp.config_json ?? {}) as Record<string, any>;
  if (key === 'label') return cfg.label ?? cfg.text ?? cfg.heading ?? typeLabel(comp.type);
  return cfg.placeholder ?? '';
}

const TYPE_GLYPH: Record<string, string> = {
  heading: 'H', button: '▣', divider: '─', text: '¶', select: '▾', date: '◷',
  rich_text: '▦', table: '⊞', textarea: '≡', image: '🖼', email: '@', number: '#', checkbox: '☑', rating: '★', file: '⤒',
};

/**
 * US-A09 AC1 — the drop indicator. Drawn as a line between two rows rather than
 * an overlay so the user sees the insert position before releasing. Uses the
 * accent token and a 6px dot, matching the existing selection ring treatment
 * (`ring-[var(--accent)]` + accent tag) already on the canvas.
 */
function DropLine() {
  return (
    <div data-drop-indicator className="flex items-center gap-1 -my-2 pointer-events-none" aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
      <span className="h-[2px] flex-1 bg-[var(--accent)] rounded-full" />
    </div>
  );
}
export function AppView({ app, pages: initialPages, workflows: initialWorkflows }: {
  app: App;
  pages: Page[];
  workflows: Workflow[];
}) {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [workflows] = useState<Workflow[]>(initialWorkflows);
  const [activePageId, setActivePageId] = useState<string>(initialPages[0]?.id || '');
  const [selected, setSelected] = useState<string | null>(null);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // US-A08 — the badge and the dialog read this, not the prop: a publish
  // mutates the row, and mutating a prop in place would desync the UI from
  // React until the next refresh lands.
  const [isPublished, setIsPublished] = useState(app.is_published);
  const [showPublish, setShowPublish] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  // US-A09 AC5 — the server's refusal, surfaced where the drop happened.
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  // US-A09 AC1/AC3 — the index a dropped component would land on, or null when
  // no component drag is in flight. Null is also what clears the indicator when
  // the pointer leaves the canvas (AC3: dropping outside changes nothing).
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // The artboard element. Drop position is measured against its rows, so the
  // indicator and the insert index always agree.
  const canvasRef = useRef<HTMLDivElement>(null);
  // US-A09 AC6 — the ids this session added, newest last, so an add can be
  // undone. Deliberately NOT the general history: redo, the 50-step cap and the
  // clear-on-publish rule are US-A12's ACs, and building them here would be two
  // implementations of one feature. Undo restores the server too, so the
  // rollback survives a reload rather than only repainting the canvas.
  const [addedIds, setAddedIds] = useState<string[]>([]);

  const activePage = pages.find((p) => p.id === activePageId);
  const selectedComp = activePage?.components.find((c) => c.id === selected) ?? null;

  const paletteItems = PALETTE
    .map((s) => ({ ...s, items: s.items.filter((i) => !paletteSearch || i.label.toLowerCase().includes(paletteSearch.toLowerCase())) }))
    .filter((s) => s.items.length > 0);


  // ---- handlers ----------------------------------------------------------
  /** US-A08 AC2/AC3 — one toggle, two directions; the response is the truth. */
  async function togglePublish() {
    setPublishLoading(true);
    try {
      const r = await fetch(`/api/apps/${app.id}/publish`, { method: 'POST' });
      if (!r.ok) return;
      const d = await r.json();
      setIsPublished(d.is_published);
      setShowPublish(false);
      router.refresh();
    } finally {
      setPublishLoading(false);
    }
  }

  async function addPage() {
    const name = prompt('Nama halaman:');
    if (!name) return;
    const slug = '/' + name.toLowerCase().replace(/[\s_]+/g, '-');
    const r = await fetch(`/api/apps/${app.id}/pages`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, route: slug }),
    });
    if (r.ok) {
      const { page } = await r.json();
      setPages([...pages, { ...page, components: [] }]);
      setActivePageId(page.id);
    }
  }

  /**
   * US-A09 AC1/AC4/AC5. `position` is the index the component was dropped on;
   * omitted means append. The server owns the ordering and the ceiling — this
   * only decides what to ask for and how to show the answer.
   */
  async function addComponent(type: string, position?: number) {
    if (!activePageId) return;
    setLimitNotice(null);
    const config: any = {};
    if (type === 'heading') config.text = 'Judul Baru';
    if (type === 'button') config.label = 'Tombol Aksi';
    if (type === 'rich_text') { config.heading = 'Judul Kartu'; config.body = 'Deskripsi singkat kartu ini.'; }
    if (type === 'text') config.label = typeLabel(type);
    if (['select', 'date', 'table'].includes(type)) config.label = typeLabel(type);
    config.placeholder = type === 'text' ? 'Isi di sini…' : undefined;

    const r = await fetch(`/api/pages/${activePageId}/components`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, config_json: config, ...(position === undefined ? {} : { position }) }),
    });

    // US-A09 AC5 — the ceiling is enforced by the server, and the message it
    // sends is the one shown. A UI-side `length >= 15` guard alone would be a
    // hint, not a limit: the endpoint would still accept the 16th component.
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      if (body?.message) setLimitNotice(body.message);
      return;
    }

    const { component } = await r.json();
    // Re-read the page's components instead of appending: an insert shifts the
    // order_index of everything below it, so the local list would otherwise
    // disagree with the database until the next reload (US-A09 AC1).
    const listed = await fetch(`/api/pages/${activePageId}/components`).then((res) => res.json()).catch(() => null);
    const next = listed?.components ?? null;
    setPages((prev) => prev.map((pg) => (pg.id === activePageId
      ? { ...pg, components: next ?? [...pg.components, component] }
      : pg)));
    setSelected(component.id);
    // US-A09 AC6
    setAddedIds((prev) => [...prev, component.id]);
  }

  /** US-A09 AC1 — the index a drop at `clientY` would land on. */
  function dropIndexAt(clientY: number): number {
    const comps = activePage?.components ?? [];
    const rows = canvasRef.current?.querySelectorAll<HTMLElement>('[data-component-row]');
    if (!rows) return comps.length;
    for (let i = 0; i < rows.length; i++) {
      const box = rows[i].getBoundingClientRect();
      if (clientY < box.top + box.height / 2) return i;
    }
    return comps.length;
  }

  async function removeComponent(id: string) {
    if (!confirm('Hapus komponen ini?')) return;
    const r = await fetch(`/api/components/${id}`, { method: 'DELETE' });
    if (r.ok) {
      setPages(pages.map((p) => (p.id === activePageId ? { ...p, components: p.components.filter((c) => c.id !== id) } : p)));
      if (selected === id) setSelected(null);
    }
  }

  /**
   * US-A09 AC4 — patch one component's config locally (instant canvas update)
   * and persist it. The local write happens first so the change is visible as
   * it is typed; the PATCH is what makes it survive a reload.
   */
  async function updateConfig(patch: Record<string, unknown>) {
    if (!selectedComp) return;
    const id = selectedComp.id;
    setPages((prev) => prev.map((pg) => ({
      ...pg,
      components: pg.components.map((c) => (c.id === id ? { ...c, config_json: { ...c.config_json, ...patch } } : c)),
    })));
    // Send only the changed keys: the endpoint merges them into the stored
    // config, so an in-flight edit cannot clobber a newer one.
    await fetch(`/api/components/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config_json: patch }),
    }).catch(() => {});
  }

  /**
   * US-A09 AC6 — undo the last component addition. The DELETE is what makes it
   * a real rollback: dropping the row from local state alone would let the next
   * page load bring the component back.
   */
  async function undoLastAdd() {
    const id = addedIds[addedIds.length - 1];
    if (!id) return;
    setAddedIds((prev) => prev.slice(0, -1));
    setPages((prev) => prev.map((pg) => ({ ...pg, components: pg.components.filter((c) => c.id !== id) })));
    if (selected === id) setSelected(null);
    await fetch(`/api/components/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  async function generateApp() {
    if (aiPrompt.length < 5) { setAiError('Prompt minimal 5 karakter.'); return; }
    setAiLoading(true); setAiError(null);
    const r = await fetch('/api/ai/generate-app', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }),
    });
    const d = await r.json();
    setAiLoading(false);
    if (!r.ok) { setAiError(d.message || 'Gagal generate.'); return; }
    setShowAi(false);
    router.refresh();
  }

  // ---- render ------------------------------------------------------------
  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--surface-page)] text-[var(--text-primary)] select-none font-body">
      {/* TOP TOOLBAR (56px) */}
      <header className="h-14 bg-[var(--surface-panel)] border-b border-[var(--border-standard)] flex items-center justify-between px-4 z-20 relative w-full">
                {/* Left: app name + status */}
        <div className="flex items-center gap-2">
          {/* The reference draws this as a hover-highlighted affordance with the
              edit glyph and nothing attached. It is the entry point to the app's
              settings page, which is where US-A07 AC1 (rename) and AC5 (delete)
              live. Geometry and type unchanged from the reference. */}
          <a
            href={`/apps/${app.id}/settings`}
            className="flex items-center gap-1.5 cursor-pointer group px-1 py-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
          >
            <span className="font-medium text-[0.875rem] text-[var(--text-primary)]">{app.name}</span>
            <span className="text-[16px] leading-none text-[var(--text-quaternary)] group-hover:text-[var(--text-secondary)] transition-colors">✎</span>
          </a>
          <span className="bg-[var(--surface-hover)] text-[var(--text-tertiary)] text-[0.75rem] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
            {isPublished ? 'Terbit' : 'Draft'}
          </span>
        </div>

{/* Center: page tabs */}
        <div className="flex items-center gap-1 h-full">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePageId(p.id)}
              className={[
                'h-full border-b-2 px-3 flex items-center font-medium text-[0.813rem] transition-colors',
                p.id === activePageId
                  ? 'border-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {p.name}
            </button>
          ))}
          <button onClick={addPage} title="Tambah Tab" className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors ml-1">
            <IconPlus size={16} />
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border-r border-[var(--border-standard)] pr-2 mr-1 gap-1">
            {/* US-A09 AC6 — the reference draws Undo as a live control; it is
                wired to the add-history above. Redo stays inert because
                US-A12 AC2 owns it, and a second implementation here would
                disagree with that card's. */}
            <button
              type="button"
              title="Undo"
              data-undo
              onClick={undoLastAdd}
              disabled={addedIds.length === 0}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] p-1.5 rounded transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text-tertiary)] disabled:cursor-default"
            >
              <span className="text-[18px] leading-none">↶</span>
            </button>
            <button title="Redo" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] p-1.5 rounded transition-colors">
              <span className="text-[18px] leading-none">↷</span>
            </button>
          </div>
          <button className="border border-[var(--border-standard)] bg-[var(--surface-panel)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium text-[0.75rem] px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-xs">
            <span className="text-[15px] leading-none">◉</span>
            <span>Pratinjau</span>
          </button>
          <button onClick={() => setShowAi(!showAi)} className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-[0.75rem] px-3.5 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-xs">
            <IconSparkles size={16} />
            <span>Generate dengan AI</span>
          </button>
          <button onClick={() => setShowPublish(true)} className="border border-[var(--border-standard)] bg-[var(--surface-panel)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium text-[0.75rem] px-3 py-1.5 rounded transition-colors shadow-xs">
            Terbitkan
          </button>
        </div>
      </header>

      {/* WORKSPACE (3 KOLOM) */}
      <div className="flex h-[calc(100vh-56px)] w-full overflow-hidden">
        {/* PALETTE KIRI 220 */}
        <aside className="w-[220px] bg-[var(--surface-panel)] border-r border-[var(--border-standard)] h-full p-3 flex flex-col gap-4 select-none shrink-0 overflow-y-auto">
          <div className="relative w-full">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[var(--text-quaternary)] pointer-events-none">⌕</span>
            <input
              type="text"
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              placeholder="Cari komponen..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-[var(--surface-page)] border border-[var(--border-standard)] rounded font-[0.813rem] text-[0.813rem] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-panel)] transition-all"
            />
          </div>
          {paletteItems.map((section) => (
            <div key={section.section} className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase text-[var(--text-quaternary)] tracking-wider px-2 py-0.5" style={{ fontWeight: 500 }}>{section.section}</span>
              {section.items.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  data-palette-item={item.type}
                  draggable
                  // US-A09 AC1 — the drag payload. Only this MIME is accepted by
                  // the canvas, so a stray text drag cannot become a component.
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_MIME, item.type);
                    e.dataTransfer.effectAllowed = 'copy';
                    setLimitNotice(null);
                  }}
                  onDragEnd={() => setDropIndex(null)}
                  // Click is kept as the keyboard/no-pointer path — the reference
                  // palette is cursor-grab, and a drag-only palette would be
                  // unreachable without a mouse.
                  onClick={() => addComponent(item.type)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] cursor-grab active:cursor-grabbing transition-colors text-left"
                >
                  <span className="text-[16px] text-[var(--text-secondary)] w-4 inline-flex justify-center">{TYPE_GLYPH[item.type]}</span>
                  <span className="font-medium text-[0.813rem]">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
          {paletteItems.length === 0 && (
            <p className="text-[0.75rem] text-[var(--text-tertiary)] px-1">Tidak ada komponen.</p>
          )}
        </aside>

        {/* CANVAS TENGAH */}
        <main className="flex-1 h-full relative overflow-auto canvas-dot-grid flex items-center justify-center p-8">
          {activePage ? (
            <div
              ref={canvasRef}
              data-builder-canvas
              // US-A09 AC1/AC3 — the drop target is the artboard itself. A drop
              // anywhere else (the palette, the inspector, the dotted backdrop
              // around this panel) never reaches a handler, so nothing is
              // created: "tidak ada komponen nyasar".
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                // preventDefault is what marks this element as a valid target;
                // skipping it makes the browser reject the drop outright.
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setDropIndex(dropIndexAt(e.clientY));
              }}
              onDragLeave={(e) => {
                // Only when the pointer actually left the artboard — a drag over
                // a child row also fires dragleave on this element.
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setDropIndex(null);
              }}
              onDrop={(e) => {
                const type = e.dataTransfer.getData(DRAG_MIME);
                if (!type) return;
                e.preventDefault();
                // The index is computed from THIS event, not read from
                // `dropIndex`: state set by a preceding dragover is not visible
                // until React re-renders, so reading it here silently appends
                // whenever a drop follows its dragover without a render in
                // between — the component lands last instead of where it was
                // released. `dropIndex` is kept for the visual indicator only.
                const at = dropIndexAt(e.clientY);
                setDropIndex(null);
                addComponent(type, at);
              }}
              className="w-[520px] bg-[var(--surface-panel)] rounded-lg p-6 shadow-sm border border-[var(--border-standard)] relative"
            >
              {/* US-A09 AC5 — the server's refusal, shown in the canvas. Same
                  critical-tint callout the apps list uses for its load error, so
                  a limit reads as a product state and not a browser alert. */}
              {limitNotice && (
                <div role="alert" className="mb-4 bg-[var(--critical-tint)] border border-[var(--critical)]/20 rounded-[6px] p-3 flex items-start justify-between gap-3">
                  <p className="text-[12px] leading-relaxed text-[var(--critical)]">{limitNotice}</p>
                  <button
                    type="button"
                    onClick={() => setLimitNotice(null)}
                    aria-label="Tutup"
                    className="shrink-0 text-[var(--critical)] hover:opacity-70 text-[12px] leading-none"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
                  <span className="font-mono text-[11px] text-[var(--text-secondary)]" style={{ fontWeight: 500 }}>Page: {activePage.name}</span>
                </div>
                <span className="font-mono text-[11px] text-[var(--text-quaternary)]" style={{ fontWeight: 500 }}>Desktop 520px</span>
              </div>

              {activePage.components.length === 0 ? (
                /* US-A09 AC2 — an empty canvas is a labelled drop area, not a
                   blank one. The copy is the AC's own wording ("geser komponen
                   ke sini"); the dashed treatment and 220px height are the ones
                   already used here, and the accent border is the existing
                   `--accent` token, so the hint reacts to a drag in flight. */
                <div
                  data-canvas-empty
                  className={[
                    'flex flex-col items-center justify-center gap-1 h-[220px] border-2 border-dashed rounded-lg transition-colors',
                    dropIndex !== null
                      ? 'border-[var(--accent)] bg-[var(--surface-accent-tint)]'
                      : 'border-[var(--border-standard)]',
                  ].join(' ')}
                >
                  <span className="text-[0.75rem] text-[var(--text-tertiary)]">geser komponen ke sini</span>
                  <span className="text-[0.75rem] text-[var(--text-quaternary)]">atau klik komponen di palet kiri</span>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {activePage.components.map((comp, i) => (
                    <Fragment key={comp.id}>
                      {/* US-A09 AC1 — where the drop will land. `-my-2` keeps the
                          2px line inside the 16px gap so the rows below do not
                          shift while dragging. */}
                      {dropIndex === i && <DropLine />}
                      {/* US-A09 AC1 — `aria-selected` is the machine-readable
                          half of "langsung muncul di panel properti": the row
                          that the inspector is describing says so. */}
                      <div
                        data-component-row
                        aria-selected={comp.id === selected}
                        className={comp.id === selected ? 'relative group' : 'relative group'}
                      >
                      {/* selection ring */}
                      {comp.id === selected && (
                        <div className="relative p-[1px] rounded ring-[1.5px] ring-[var(--accent)] -m-[1px]">
                          {/* corner handles */}
                          <span className="absolute -top-1 -left-1 w-2 h-2 bg-[var(--surface-panel)] border border-[var(--accent)] rounded-xs pointer-events-none z-10" />
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--surface-panel)] border border-[var(--accent)] rounded-xs pointer-events-none z-10" />
                          <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-[var(--surface-panel)] border border-[var(--accent)] rounded-xs pointer-events-none z-10" />
                          <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-[var(--surface-panel)] border border-[var(--accent)] rounded-xs pointer-events-none z-10" />
                          <div className="absolute -top-6 left-0 bg-[var(--accent)] text-white font-mono text-[10px] px-1.5 py-0.5 rounded shadow-xs z-10 flex items-center gap-1">
                            <span>{typeLabel(comp.type)}</span>
                            <span className="opacity-70">•</span>
                            <span className="opacity-90">#{comp.id.slice(0, 8)}</span>
                          </div>
                          <ComponentPreview comp={comp} />
                        </div>
                      )}
                      {comp.id !== selected && (
                        <div onClick={() => setSelected(comp.id)} className="cursor-pointer rounded hover:ring-[1.5px] hover:ring-[var(--accent)]/40 -m-[1px]">
                          <ComponentPreview comp={comp} />
                        </div>
                      )}
                      {/* index hint (subtle) */}
                      <span className="absolute -left-4 top-0 font-mono text-[10px] text-[var(--text-quaternary)]">{i + 1}</span>
                      </div>
                      {/* dropping past the last row appends */}
                      {dropIndex === i + 1 && i === activePage.components.length - 1 && <DropLine />}
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[300px] text-[0.75rem] text-[var(--text-tertiary)]">
              Buat halaman dulu untuk mulai mengatur.
            </div>
          )}

          {/* Zoom & Pan controls */}
          <div className="absolute bottom-4 left-4 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded shadow-sm flex items-center p-1 gap-1">
            <button title="Zoom In" className="w-7 h-7 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded transition-colors">+</button>
            <span className="font-mono text-[11px] text-[var(--text-secondary)] px-1.5">100%</span>
            <button title="Zoom Out" className="w-7 h-7 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded transition-colors">−</button>
            <div className="h-3.5 w-[1px] bg-[var(--border-standard)] mx-0.5" />
            <button title="Fit to Screen" className="w-7 h-7 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded transition-colors">⌖</button>
          </div>
        </main>

        {/* INSPECTOR KANAN 280 */}
        <aside className="w-[280px] bg-[var(--surface-panel)] border-l border-[var(--border-standard)] h-full p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          {selectedComp ? (
            <>
              <div className="flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4">
                  <span className="font-medium text-[0.813rem] text-[var(--text-primary)]">{typeLabel(selectedComp.type)}</span>
                  <span className="font-mono text-[10px] bg-[var(--surface-hover)] text-[var(--text-tertiary)] font-medium px-2 py-0.5 rounded">{selectedComp.type.toUpperCase()}</span>
                </div>
                <div className="flex flex-col gap-4">
                  {/* Label field — US-A09 AC4: editable, and the canvas
                      re-renders from the same state, so the change is visible
                      as it is typed rather than after a reload. */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="inspector-label" className="text-[0.75rem] text-[var(--text-tertiary)]">{selectedComp.type === 'button' ? 'Label Tombol' : 'Label'}</label>
                    <input
                      id="inspector-label"
                      value={cfgField(selectedComp, 'label')}
                      onChange={(e) => updateConfig({ label: e.target.value })}
                      className="h-10 px-3 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded text-[0.813rem] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  {/* Placeholder — only meaningful for the field-like types. The
                      reference inspector shows one property set per selected
                      type (the button variant has none of these), so this is the
                      same treatment applied to the input types. */}
                  {FIELD_TYPES.has(selectedComp.type) && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="inspector-placeholder" className="text-[0.75rem] text-[var(--text-tertiary)]">Placeholder</label>
                      <input
                        id="inspector-placeholder"
                        value={cfgField(selectedComp, 'placeholder')}
                        onChange={(e) => updateConfig({ placeholder: e.target.value })}
                        className="h-10 px-3 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded text-[0.813rem] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  )}
                  {/* Wajib-isi — a real checkbox, not a styled div: the AC names
                      it as a setting, and the canvas shows the marker. */}
                  {FIELD_TYPES.has(selectedComp.type) && (
                    <div className="flex items-center gap-2 py-1">
                      <input
                        id="inspector-required"
                        type="checkbox"
                        checked={!!selectedComp.config_json?.required}
                        onChange={(e) => updateConfig({ required: e.target.checked })}
                        className="accent-[var(--accent)] w-4 h-4"
                      />
                      <label htmlFor="inspector-required" className="text-[0.813rem] text-[var(--text-secondary)] cursor-pointer">Wajib diisi</label>
                    </div>
                  )}
                  {selectedComp.type === 'button' && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.75rem] text-[var(--text-tertiary)]">Aksi Saat Diklik</label>
                        <select className="w-full h-10 pl-3 pr-8 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded text-[0.813rem] text-[var(--text-primary)] appearance-none focus:outline-none focus:border-[var(--accent)]">
                          <option>Submit Form &amp; Validasi AI</option>
                          <option>Navigasi Halaman</option>
                          <option>Buka Modal Konfirmasi</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.75rem] text-[var(--text-tertiary)]">Variasi Tampilan</label>
                        <div className="bg-[var(--surface-hover)] p-0.5 rounded flex items-center text-center">
                          {['Primer', 'Sekunder', 'Ghost'].map((v, i) => (
                            <button key={v} className={i === 0 ? 'flex-1 py-1.5 bg-[var(--surface-panel)] text-[var(--text-primary)] font-medium text-[0.75rem] rounded shadow-xs' : 'flex-1 py-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] font-medium text-[0.75rem] transition-colors'}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Lebar */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.75rem] text-[var(--text-tertiary)]">Lebar</label>
                        <div className="bg-[var(--surface-hover)] p-0.5 rounded flex items-center text-center">
                          {['Otomatis', 'Penuh 100%'].map((w, wi) => (
                            <button key={w} className={wi === 0 ? 'flex-1 py-1.5 bg-[var(--surface-panel)] text-[var(--text-primary)] font-medium text-[0.75rem] rounded shadow-xs' : 'flex-1 py-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] font-medium text-[0.75rem] transition-colors'}>
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Status Awal */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.75rem] text-[var(--text-tertiary)]">Status Awal</label>
                        <div className="flex gap-4">
                          {['Aktif', 'Nonaktif'].map((st) => (
                            <label key={st} className="flex items-center gap-1.5 text-[0.75rem] text-[var(--text-secondary)] cursor-pointer">
                              <input type="radio" name="status-awal" defaultChecked={st === 'Aktif'} className="accent-[var(--accent)]" />
                              {st}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-standard)] mt-6">
                <button onClick={() => removeComponent(selectedComp.id)} className="w-full text-[var(--critical)] hover:underline cursor-pointer font-medium text-[0.75rem] flex items-center gap-1.5 py-1.5 transition-colors">
                  <IconTrash size={16} />
                  <span>Hapus komponen</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4">
                  <span className="font-medium text-[0.813rem] text-[var(--text-primary)]">Halaman</span>
                  <button onClick={addPage} className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors">
                    <IconPlus size={15} />
                  </button>
                </div>
                <div className="flex flex-col gap-0.5">
                  {pages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActivePageId(p.id)}
                      className={[
                        'h-8 px-2 rounded text-[0.75rem] text-left flex items-center gap-1.5 transition-colors',
                        p.id === activePageId ? 'bg-[var(--surface-accent-tint)] text-[var(--accent-hover)] font-medium' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                      ].join(' ')}
                    >
                      <IconChevronRight size={11} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[0.75rem] text-[var(--text-tertiary)]">Pilih komponen di canvas untuk melihat properti.</p>
            </div>
          )}
        </aside>
      </div>

      {/* AI MODAL */}
      {showAi && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-[480px] bg-[var(--surface-panel)] rounded-lg border border-[var(--border-standard)] p-6 shadow-xl">
            <h3 className="text-[1rem] font-semibold mb-2">Generate dengan AI</h3>
            <p className="text-[0.75rem] text-[var(--text-tertiary)] mb-4">
              Deskripsikan app yang lu mau. AI akan generate halaman, komponen, dan workflow.
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Contoh: buat form input data supplier dengan notifikasi email"
              className="w-full h-24 p-2 border border-[var(--border-standard)] rounded-md text-[0.813rem] resize-none focus:outline-none focus:border-[var(--accent)]"
            />
            {aiError && <p className="text-[0.75rem] text-[var(--critical)] mt-2">{aiError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAi(false)} className="h-8 px-3 rounded-md text-[0.75rem] border border-[var(--border-standard)] hover:bg-[var(--surface-sunken)]">Batal</button>
              <button onClick={generateApp} disabled={aiLoading} className="h-8 px-3 rounded-md text-[0.75rem] font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50">
                {aiLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* US-A08 AC2/AC3 — publish and unpublish go through the shared Modal;
          the reference draws "Terbitkan" as a plain toolbar button, so the
          confirmation reuses the confirm-dialog treatment already on the
          settings screen rather than inventing a new one. */}
      <Modal
        open={showPublish}
        title={isPublished ? `Batalkan publikasi ${app.name}?` : `Terbitkan ${app.name}?`}
        description={
          isPublished
            ? 'Tautan publik kembali menampilkan halaman "belum dipublikasikan". Data yang sudah masuk tidak terhapus.'
            : `Setelah diterbitkan, siapa pun dengan tautan publik ${app.slug} bisa membuka dan mengirim data ke aplikasi ini.`
        }
        onClose={() => setShowPublish(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowPublish(false)}
              className="h-8 px-3 rounded-[6px] text-[12px] border border-[var(--border-standard)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={togglePublish}
              disabled={publishLoading}
              className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
            >
              {publishLoading ? 'Memproses…' : isPublished ? 'Batalkan publikasi' : 'Terbitkan'}
            </button>
          </>
        }
      />
    </div>
  );
}
