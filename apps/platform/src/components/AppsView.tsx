'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@portico/ui/icons';
import { PlatformShell } from './PlatformShell';

interface AppRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: number;
  is_published: boolean;
  created_at: string;
}

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
  const [segment, setSegment] = useState<'semua' | 'saya' | 'tim'>('semua');
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/apps', { cache: 'no-store' });
    if (r.status === 401) {
      router.push('/login');
      return;
    }
    const d = await r.json();
    setApps(d.apps ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createApp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = await fetch('/api/apps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName, description: '' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.message ?? 'Gagal membuat app.');
      return;
    }
    setNewName('');
    setShowForm(false);
    await load();
  }

  const filtered = apps.filter((a) => {
    const q = search.toLowerCase();
    const matchQ = !q || (a.name + ' ' + a.slug + ' ' + (a.description ?? '')).toLowerCase().includes(q);
    return matchQ;
  });

  const canCreate = user.role === 'admin' || user.role === 'builder';

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
                onClick={() => setShowForm(!showForm)}
                className="h-8 px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-[6px] text-[13px] font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <IconPlus size={16} />
                <span>Aplikasi baru</span>
              </button>
            )}
          </div>

          {showForm && (
            <form onSubmit={createApp} className="max-w-xl bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[8px] p-4 flex items-center gap-3">
              {error && <p className="text-sm text-[var(--critical)]">{error}</p>}
              <input
                type="text"
                required
                placeholder="Nama aplikasi (misal: CRM Penjualan)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 h-9 px-3 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[6px] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button type="submit" className="h-8 px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-[6px] text-[13px] font-medium transition-colors">Buat</button>
            </form>
          )}

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
              {/* Dropdown Status */}
              <button className="h-9 px-3 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[6px] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2 hover:bg-[var(--surface-hover)] transition-colors">
                <span>Status: <strong className="font-medium text-[var(--text-primary)]">Semua</strong></span>
                <span className="text-[var(--text-tertiary)] text-sm">▾</span>
              </button>
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
          {loading ? (
            <p className="text-sm text-[var(--text-tertiary)]">Memuat…</p>
          ) : filtered.length === 0 ? (
            <div className="bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[8px] p-12 text-center">
              <p className="text-[var(--text-tertiary)] text-sm">{search ? 'Tidak ada hasil.' : 'Belum ada aplikasi. Buat yang pertama!'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 pt-1">
              {filtered.map((a) => {
                return (
                  <a
                    key={a.id}
                    href={`/apps/${a.id}`}
                    className="bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[8px] p-4 hover:border-[var(--accent)]/40 transition-colors flex flex-col justify-between h-[160px] cursor-pointer shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.08)]"
                  >
                    <div>
                      <h3 className="text-[16px] leading-snug truncate text-[var(--text-primary)]" style={{ fontWeight: 560 }}>{a.name}</h3>
                      <div className="font-mono text-[11px] text-[var(--text-tertiary)] mt-0.5 tracking-tight">app/{a.slug}</div>
                      <p className="text-[14px] text-[var(--text-secondary)] mt-2 line-clamp-2 leading-relaxed">
                        {a.description || 'Belum ada deskripsi. Buka builder untuk mulai mengatur.'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] mt-auto">
                      <span className={a.is_published
                        ? 'font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#e8f6ee] text-[#15803d] font-medium'
                        : 'font-mono text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)] font-medium'}>
                        {a.is_published ? 'Terbit' : 'Draft'}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--text-quaternary)]">{a.created_at ? `diubah ${timeAgo(a.created_at)}` : ''}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PlatformShell>
  );
}