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
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconSparkles, IconTrash, IconChevronRight } from '@portico/ui/icons';

// ---- types ---------------------------------------------------------------
interface App { id: string; name: string; slug: string; description: string | null; is_published: boolean }
interface Component { id: string; page_id: string; type: string; config_json: any; order_index: number }
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

const TYPE_GLYPH: Record<string, string> = {
  heading: 'H', button: '▣', divider: '─', text: '¶', select: '▾', date: '◷',
  rich_text: '▦', table: '⊞', textarea: '≡', image: '🖼', email: '@', number: '#', checkbox: '☑', rating: '★', file: '⤒',
};

// Component preview renderers (visual, per-type).
function ComponentPreview({ comp }: { comp: Component }) {
  const cfg = comp.config_json ?? {};
  const label = cfg.label ?? cfg.text ?? typeLabel(comp.type);
  switch (comp.type) {
    case 'heading':
      return <h2 className="font-bold text-[1rem] text-[var(--text-primary)]">{cfg.text || label}</h2>;
    case 'button':
      return <button className="w-full bg-[var(--accent)] text-white font-medium text-[0.813rem] px-5 py-2.5 rounded text-center shadow-sm">{label}</button>;
    case 'divider':
      return <div className="h-px bg-[var(--border-standard)]" />;
    case 'text':
    case 'email':
    case 'number':
    case 'textarea':
    case 'date':
      return (
        <div>
          <label className="block text-[0.75rem] text-[var(--text-tertiary)] mb-1.5 font-medium">{label}</label>
          <div className="h-[38px] border border-[var(--border-standard)] rounded px-3 text-[0.875rem] text-[var(--text-quaternary)] bg-[var(--surface-panel)] flex items-center">
            {cfg.placeholder ?? 'Isi di sini…'}
          </div>
        </div>
      );
    case 'select':
      return (
        <div>
          <label className="block text-[0.75rem] text-[var(--text-tertiary)] mb-1.5 font-medium">{label}</label>
          <div className="h-[38px] border border-[var(--border-standard)] rounded px-3 text-[0.875rem] text-[var(--text-quaternary)] bg-[var(--surface-panel)] flex items-center justify-between">
            <span>Pilih opsi…</span>
            <span className="text-[var(--text-quaternary)]">▾</span>
          </div>
        </div>
      );
    case 'rich_text':
      return (
        <div className="bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-lg p-4 shadow-sm">
          <h2 className="font-bold text-[1rem] text-[var(--text-primary)]">{cfg.heading || 'Judul Kartu'}</h2>
          <p className="text-[0.813rem] text-[var(--text-secondary)] mt-1">{cfg.body ?? 'Deskripsi singkat kartu ini.'}</p>
        </div>
      );
    case 'table':
      return (
        <div>
          <label className="block text-[0.75rem] text-[var(--text-tertiary)] mb-1.5 font-medium">{label}</label>
          <div className="border border-[var(--border-standard)] rounded overflow-hidden">
            <div className="flex py-2 px-3 bg-[var(--surface-sunken)] text-[0.75rem] font-medium text-[var(--text-tertiary)]">
              <span className="flex-1">Kolom 1</span><span className="flex-1">Kolom 2</span>
            </div>
            <div className="flex py-2 px-3 text-[0.75rem] text-[var(--text-secondary)]">
              <span className="flex-1">–</span><span className="flex-1">–</span>
            </div>
          </div>
        </div>
      );
    default:
      return <span className="text-[0.75rem] text-[var(--text-secondary)]">{label}</span>;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'heading': return 'Judul';
    case 'button': return 'Tombol';
    case 'divider': return 'Pemisah';
    case 'text': return 'Input teks';
    case 'select': return 'Dropdown';
    case 'date': return 'Tanggal';
    case 'rich_text': return 'Kartu';
    case 'table': return 'Tabel';
    case 'textarea': return 'Area teks';
    case 'image': return 'Gambar';
    case 'email': return 'Email';
    case 'number': return 'Angka';
    case 'checkbox': return 'Centang';
    case 'rating': return 'Rating';
    case 'file': return 'Upload';
    default: return type;
  }
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

  const activePage = pages.find((p) => p.id === activePageId);
  const selectedComp = activePage?.components.find((c) => c.id === selected) ?? null;

  const paletteItems = PALETTE
    .map((s) => ({ ...s, items: s.items.filter((i) => !paletteSearch || i.label.toLowerCase().includes(paletteSearch.toLowerCase())) }))
    .filter((s) => s.items.length > 0);

  // ---- handlers ----------------------------------------------------------
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

  async function addComponent(type: string) {
    if (!activePageId) return;
    const config: any = {};
    if (type === 'heading') config.text = 'Judul Baru';
    if (type === 'button') config.label = 'Tombol Aksi';
    if (type === 'rich_text') { config.heading = 'Judul Kartu'; config.body = 'Deskripsi singkat kartu ini.'; }
    if (type === 'text') config.label = typeLabel(type);
    if (['select', 'date', 'table'].includes(type)) config.label = typeLabel(type);
    config.placeholder = type === 'text' ? 'Isi di sini…' : undefined;

    const r = await fetch(`/api/pages/${activePageId}/components`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, config_json: config }),
    });
    if (r.ok) {
      const { component } = await r.json();
      setPages(pages.map((p) => (p.id === activePageId ? { ...p, components: [...p.components, component] } : p)));
      setSelected(component.id);
    }
  }

  async function removeComponent(id: string) {
    if (!confirm('Hapus komponen ini?')) return;
    const r = await fetch(`/api/components/${id}`, { method: 'DELETE' });
    if (r.ok) {
      setPages(pages.map((p) => (p.id === activePageId ? { ...p, components: p.components.filter((c) => c.id !== id) } : p)));
      if (selected === id) setSelected(null);
    }
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
          <div className="flex items-center gap-1.5 cursor-pointer group px-1 py-1 rounded hover:bg-[var(--surface-hover)] transition-colors">
            <span className="font-medium text-[0.875rem] text-[var(--text-primary)]">{app.name}</span>
            <span className="text-[16px] leading-none text-[var(--text-quaternary)] group-hover:text-[var(--text-secondary)] transition-colors">✎</span>
          </div>
          <span className="bg-[var(--surface-hover)] text-[var(--text-tertiary)] text-[0.75rem] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
            {app.is_published ? 'Terbit' : 'Draft'}
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
            <button title="Undo" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] p-1.5 rounded transition-colors">
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
          <button onClick={() => router.push('/apps')} className="border border-[var(--border-standard)] bg-[var(--surface-panel)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium text-[0.75rem] px-3 py-1.5 rounded transition-colors shadow-xs">
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
                  onClick={() => addComponent(item.type)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] cursor-grab transition-colors text-left"
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
            <div className="w-[520px] bg-[var(--surface-panel)] rounded-lg p-6 shadow-sm border border-[var(--border-standard)] relative">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
                  <span className="font-mono text-[11px] text-[var(--text-secondary)]" style={{ fontWeight: 500 }}>Page: {activePage.name}</span>
                </div>
                <span className="font-mono text-[11px] text-[var(--text-quaternary)]" style={{ fontWeight: 500 }}>Desktop 520px</span>
              </div>

              {activePage.components.length === 0 ? (
                <div className="flex items-center justify-center h-[220px] border-2 border-dashed border-[var(--border-standard)] rounded-lg">
                  <span className="text-[0.75rem] text-[var(--text-tertiary)]">Klik komponen di kiri untuk menambah</span>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {activePage.components.map((comp, i) => (
                    <div key={comp.id} className={comp.id === selected ? 'relative group' : 'relative group'}>
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
                  {/* Label field */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.75rem] text-[var(--text-tertiary)]">{selectedComp.type === 'button' ? 'Label Tombol' : 'Label'}</label>
                    <input
                      defaultValue={selectedComp.config_json?.label ?? selectedComp.config_json?.text ?? cfgPlaceholder(selectedComp)}
                      readOnly
                      className="h-10 px-3 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded text-[0.813rem] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
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
    </div>
  );
}

function cfgPlaceholder(comp: Component): string {
  const cfg = comp.config_json ?? {};
  return cfg.label ?? cfg.text ?? cfg.heading ?? comp.type;
}