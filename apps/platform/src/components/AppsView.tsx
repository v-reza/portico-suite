'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconSparkles } from '@portico/ui/icons';
import { PlatformShell } from './PlatformShell';
import { CreateAppModal } from './CreateAppModal';
import { PromptAppModal } from './PromptAppModal';

interface AppRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: number;
  is_published: boolean;
  archived_at: string | null;
  created_at: string;
  /** AC1's "waktu terakhir diubah" — the column the card's timestamp reads. */
  updated_at: string;
}

type Status = 'semua' | 'terbit' | 'draft' | 'terarsip';

const STATUS_LABEL: Record<Status, string> = {
  semua: 'Semua',
  terbit: 'Terbit',
  draft: 'Draft',
  terarsip: 'Terarsip',
};

/**
 * The status filter is a server-side query, not a client-side hide: an archived
 * app must be absent from the main list for a caller that bypasses the UI too
 * (US-A07 AC2). `terarsip` is the one view that lists them, and it is where the
 * restore entry point lives (US-A07 AC3).
 */
const STATUS_QUERY: Record<Status, string> = {
  semua: '',
  terbit: '?status=published',
  draft: '?status=draft',
  terarsip: '?status=archived',
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.round(h / 24);
  return `${d}h lalu`;
}

export function AppsView({ user, appCount }: { user: { name: string; role: string }; appCount?: string }) {
  const router = useRouter();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('semua');
  const [statusOpen, setStatusOpen] = useState(false);
  const [segment, setSegment] = useState<'semua' | 'saya' | 'tim'>('semua');
  const [showCreate, setShowCreate] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  // AC4 — a failed load is its own state. It is deliberately not folded into
  // `loading`: a skeleton promises the data is coming, and after a failure it
  // is not.
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  /**
   * AC3 — `loading` starts true and is only cleared once the request settles,
   * so the first paint is the skeleton rather than an empty screen.
   * AC4 — a non-2xx or a thrown fetch clears `apps` instead of keeping the
   * previous list: half a list under an error banner reads as real data.
   *
   * US-A07 AC2/AC3 — accepts an explicit status query so the status dropdown
   * drives the server-side filter directly.
   */
  async function load(which: Status = status) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/apps${STATUS_QUERY[which]}`, { cache: 'no-store' });
      if (r.status === 401) {
        router.push('/login');
        return;
      }
      if (!r.ok) {
        setApps([]);
        setError(`Gagal memuat daftar aplikasi (${r.status}).`);
        return;
      }
      const d = await r.json();
      setApps(Array.isArray(d?.apps) ? d.apps : []);
    } catch {
      setApps([]);
      setError('Gagal memuat daftar aplikasi. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load('semua'); }, []);

  async function pickStatus(next: Status) {
    setStatus(next);
    setStatusOpen(false);
    await load(next);
  }

  /**
   * Restore (US-A07 AC3) lives on the archived list, because that is the only
   * view where the card is reachable. Archive itself is on the app's settings
   * page, next to the other destructive actions.
   */
  async function restore(id: string) {
    setBusy(id);
    setError(null);
    const r = await fetch(`/api/apps/${id}/restore`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      setError(d.message ?? 'Gagal memulihkan aplikasi.');
      return;
    }
    await load(status);
  }

  /**
   * US-A05 AC1 — a created app is a draft and the user lands in its editor.
   * The row is already in the DB (the modal POSTed it), so this only navigates;
   * no refetch of the list happens behind the user's back.
   */
  function onCreated(app: { id: string }) {
    setShowCreate(false);
    router.push(`/apps/${app.id}`);
  }

  const filtered = apps.filter((a) => {
    const q = search.toLowerCase();
    const matchQ = !q || (a.name + ' ' + a.slug + ' ' + (a.description ?? '')).toLowerCase().includes(q);
    return matchQ;
  });

  const canCreate = user.role === 'admin' || user.role === 'builder';
  const state = loading ? 'loading' : error ? 'error' : apps.length === 0 ? 'empty' : 'ready';

  return (
    <PlatformShell
      active="apps"
      user={{ name: user.name, role: user.role }}
      toolbar={
        <div className="flex items-center gap-3">
          {/* Compact search */}
          <div className="relative w-60">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-quaternary)] text-sm">⌕</span>
            <input
              type="text"
              placeholder="Cari menu..."
              className="w-full h-8 pl-8 pr-3 bg-[var(--surface-page)] rounded-md border border-[var(--border-standard)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-panel)] transition-colors"
            />
          </div>
          <button title="Filter" className="w-8 h-8 rounded-md border border-[var(--border-standard)] bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
            {/* tune glyph */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M5 7.5h14M5 12h14M5 16.5h14" />
              <circle cx="9" cy="7.5" r="2" />
              <circle cx="15" cy="12" r="2" />
              <circle cx="9" cy="16.5" r="2" />
            </svg>
          </button>
          <div className="w-[1px] h-4 bg-[var(--border-standard)]" />
          <div className="w-[26px] h-[26px] rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)] flex items-center justify-center text-[11px] font-mono font-medium">
            {user.name.split(/\s+/).map((w) => w[0].toUpperCase()).slice(0, 2).join('') || 'U'}
          </div>
        </div>
      }
    >
      <div className="px-6 py-5">
        <div className="w-full flex flex-col gap-4">
          {/* Baris aksi */}
          <div className="h-12 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[1.25rem] tracking-tight text-[var(--text-primary)]" style={{ fontWeight: 590 }}>Daftar Aplikasi</h2>
            </div>
            {canCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="h-8 px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-[6px] text-[13px] font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <IconPlus size={18} />
                <span>Aplikasi baru</span>
              </button>
            )}
          </div>

          {/* Baris alat */}
          <div className="h-11 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-quaternary)] text-sm">⌕</span>
              <input
                type="text"
                placeholder="Cari nama aplikasi atau slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-[var(--surface-panel)] rounded-[6px] border border-[var(--border-standard)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div className="flex items-center gap-3">
              {/* Dropdown Status — drives the server-side status filter (US-A07 AC2/AC3) */}
              <div className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={statusOpen}
                  onClick={() => setStatusOpen((v) => !v)}
                  className="h-9 px-3 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[6px] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2 hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <span>Status: <strong className="font-medium text-[var(--text-primary)]">{STATUS_LABEL[status]}</strong></span>
                  <span className="text-[var(--text-tertiary)] text-sm">▾</span>
                </button>
                {statusOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-full mt-1 z-30 w-[160px] bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[8px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] py-1"
                  >
                    {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="option"
                        aria-selected={status === s}
                        onClick={() => pickStatus(s)}
                        className={[
                          'w-full text-left px-3 py-1.5 text-[13px] transition-colors',
                          status === s
                            ? 'bg-[var(--surface-accent-tint)] text-[var(--accent-hover)] font-medium'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
                        ].join(' ')}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Segment Semua / Saya / Tim */}
              <div className="h-9 p-0.5 bg-[var(--surface-sunken)] rounded-[6px] border border-[var(--border-standard)] flex items-center">
                {(['semua', 'saya', 'tim'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSegment(s)}
                    className={[
                      'h-full px-3 rounded-[4px] text-[13px] flex items-center gap-1.5 transition-colors',
                      segment === s
                        ? 'bg-[var(--surface-panel)] text-[var(--text-primary)] font-medium'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    ].join(' ')}
                  >
                    <span className="capitalize">{s}</span>
                    {s === 'semua' && (
                      <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                        {appCount ?? filtered.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid kartu */}
          <div data-state={state}>
          {loading ? (
            /* AC3 — helpdesk ticket list loading pattern: `#ededf0` blocks under 1.8s pulse */
            <div className="grid grid-cols-3 gap-3 pt-1" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-pulse bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[8px] p-4 h-[160px] flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-[var(--surface-sunken)] rounded" />
                    <div className="h-2.5 w-24 bg-[var(--surface-sunken)] rounded" />
                    <div className="h-3 w-full bg-[var(--surface-sunken)] rounded pt-1" />
                    <div className="h-3 w-4/5 bg-[var(--surface-sunken)] rounded" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                    <div className="h-4 w-16 bg-[var(--surface-sunken)] rounded-full" />
                    <div className="h-2.5 w-20 bg-[var(--surface-sunken)] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            /* AC4 — critical tint callout with retry */
            <div role="alert" className="bg-[var(--critical-tint)] border border-[var(--critical)]/20 rounded-[6px] p-3">
              <p className="text-[12px] leading-relaxed text-[var(--critical)]">{error}</p>
              <button
                type="button"
                onClick={() => load(status)}
                className="bg-[var(--surface-panel)] border border-[var(--border-standard)] text-[var(--text-primary)] px-3 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[var(--surface-hover)] mt-2.5 inline-flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4.5a7.5 7.5 0 1 1-5.3 2.2" />
                  <path d="M3.5 3.5v4.5h4.5" />
                </svg>
                <span>Coba lagi</span>
              </button>
            </div>
          ) : apps.length === 0 ? (
            /* AC2 — two actions, no apps (empty state) */
            <div className="bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[8px] p-12 flex flex-col items-center justify-center text-center select-none">
              <div className="w-10 h-10 rounded-full bg-[var(--surface-hover)] flex items-center justify-center mb-3 text-[var(--text-quaternary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
                  <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
                  <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
                  <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-1">
                {status === 'terarsip' ? 'Tidak ada aplikasi yang diarsipkan' : 'Belum ada aplikasi'}
              </h3>
              <p className="text-[12px] text-[var(--text-tertiary)] max-w-[280px] mb-4">
                {status === 'terarsip'
                  ? 'Aplikasi yang diarsipkan akan muncul di sini dan bisa dipulihkan kapan saja.'
                  : 'Mulai dari satu deskripsi, atau susun sendiri dari kanvas kosong.'}
              </p>
              {canCreate && status !== 'terarsip' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPrompt(true)}
                    className="h-8 px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-[6px] text-[13px] font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <IconSparkles size={16} />
                    <span>Buat dari prompt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="h-8 px-3.5 bg-[var(--surface-panel)] border border-[rgba(15,23,42,0.12)] text-[var(--text-primary)] rounded-[6px] text-[13px] font-medium flex items-center gap-1.5 hover:bg-[var(--surface-hover)] transition-colors shadow-sm"
                  >
                    <IconPlus size={16} />
                    <span>Buat kosong</span>
                  </button>
                </div>
              )}
            </div>
          ) : filtered.length === 0 ? (
            /* Search filter matched nothing */
            <div className="bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[8px] p-12 text-center">
              <p className="text-[var(--text-tertiary)] text-sm">Tidak ada aplikasi yang cocok dengan pencarian.</p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="h-7 px-3 mt-4 rounded-md bg-[var(--surface-panel)] border border-[rgba(15,23,42,0.12)] text-[var(--text-primary)] text-[12px] font-medium hover:bg-[var(--surface-hover)] transition-colors shadow-sm"
              >
                Bersihkan pencarian
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 pt-1">
              {filtered.map((a) => {
                const cardClass =
                  'bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[8px] p-4 transition-colors flex flex-col justify-between h-[160px] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.08)]';
                const body = (
                  <>
                    <div>
                      <h3 className="text-[16px] leading-snug truncate text-[var(--text-primary)]" style={{ fontWeight: 560 }}>{a.name}</h3>
                      <div className="font-mono text-[11px] text-[var(--text-tertiary)] mt-0.5 tracking-tight">app/{a.slug}</div>
                      <p className="text-[14px] text-[var(--text-secondary)] mt-2 line-clamp-2 leading-relaxed">
                        {a.description || 'Belum ada deskripsi. Buka builder untuk mulai mengatur.'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] mt-auto">
                      <span className={
                        a.archived_at
                          ? 'font-mono text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-tertiary)] font-medium'
                          : a.is_published
                            ? 'font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#e8f6ee] text-[#15803d] font-medium'
                            : 'font-mono text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)] font-medium'
                      }>
                        {a.archived_at ? 'Terarsip' : a.is_published ? 'Terbit' : 'Draft'}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--text-quaternary)]">
                        diubah {timeAgo(a.updated_at)}
                      </span>
                    </div>
                  </>
                );

                if (a.archived_at) {
                  return (
                    <article key={a.id} data-app-card={a.id} className={cardClass}>
                      {body}
                      <button
                        type="button"
                        disabled={busy === a.id}
                        onClick={() => restore(a.id)}
                        className="mt-2 h-7 px-3 rounded-[6px] text-[12px] font-medium border border-[var(--border-standard)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                      >
                        {busy === a.id ? 'Memulihkan…' : 'Pulihkan'}
                      </button>
                    </article>
                  );
                }

                return (
                  <a
                    key={a.id}
                    data-app-card={a.id}
                    href={`/apps/${a.id}`}
                    className={`${cardClass} hover:border-[var(--accent)]/40 cursor-pointer`}
                  >
                    {body}
                  </a>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>

      <CreateAppModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={onCreated} />
      <PromptAppModal open={showPrompt} onClose={() => setShowPrompt(false)} onCreated={onCreated} />
    </PlatformShell>
  );
}
