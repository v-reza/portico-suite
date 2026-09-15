'use client';

/**
 * AppSettingsView — `/apps/[id]/settings`, cloned class-for-class from the
 * Stitch reference `platform_pengaturan_aplikasi_sumber_data`.
 *
 * Cloned from the reference: the 200px inner nav tab (active row is
 * `bg-surface-accent-tint text-accent-hover border-l-2 border-accent-hover`),
 * the 48px top bar carrying the mono app name next to the title, the white
 * `p-6 rounded-lg border` section panels, `h-10` inputs with the
 * `app.portico.internal/` prefix well, the 3-row description textarea, and the
 * Zona Berbahaya panel bordered `#fdecec` with its `bg-critical` button.
 *
 * Two sections are deliberately NOT rendered — "Sumber Data" (US-A26) and
 * "Anggaran AI" (US-A17). The reference draws all four nav items, but those two
 * screens are owned by their own cards; rendering tabs that open nothing would
 * ship a dead affordance, which is worse than a shorter nav. Their sections get
 * appended by whoever lands those stories.
 *
 * The reference does not draw archive/restore at all (archiving is US-A07, a
 * story the settings mock predates). That section is composed from the tokens
 * and patterns already on this screen — same panel, same label/input rhythm,
 * same secondary-button treatment as the General section — rather than invented.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@portico/ui/modal';
import { PlatformShell } from './PlatformShell';

interface AppRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_published: boolean;
  archived_at: string | null;
}

export function AppSettingsView({
  user,
  app,
  counts,
}: {
  user: { name: string; role: string };
  app: AppRow;
  counts: { pages: number; components: number; rows: number };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'general' | 'danger'>('general');
  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [typed, setTyped] = useState('');

  const archived = !!app.archived_at;
  const canEdit = user.role === 'admin' || user.role === 'builder';
  const isAdmin = user.role === 'admin';

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setSaved(null);
    if (!name.trim()) {
      setError('Nama aplikasi wajib diisi.');
      return;
    }
    setSaving(true);
    const r = await fetch(`/api/apps/${app.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description }),
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      setError(d.message ?? 'Gagal menyimpan.');
      return;
    }
    setSaved(d.app?.updated_at ?? 'tersimpan');
    router.refresh();
  }

  async function setArchived(next: boolean) {
    setError(null);
    const r = await fetch(`/api/apps/${app.id}/${next ? 'archive' : 'restore'}`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setConfirmArchive(false);
    if (!r.ok) {
      setError(d.message ?? 'Gagal mengubah status arsip.');
      return;
    }
    router.refresh();
  }

  async function destroy() {
    setError(null);
    const r = await fetch(`/api/apps/${app.id}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    setConfirmDelete(false);
    if (!r.ok) {
      setError(d.message ?? 'Gagal menghapus.');
      return;
    }
    router.push('/apps');
  }

  // The reference labels the bar '(1 modifikasi pada deskripsi)' — name the field(s)
  // that actually changed so the copy stays truthful for both form fields.
  const changedFields = [
    name !== app.name ? 'nama' : null,
    description !== (app.description ?? '') ? 'deskripsi' : null,
  ].filter((f): f is string => f !== null);
  const dirty = changedFields.length > 0;

  function reset() {
    setName(app.name);
    setDescription(app.description ?? '');
    setError(null);
    setSaved(null);
  }

  const NAV = [
    { id: 'general' as const, label: 'General', glyph: '⚙' },
    { id: 'danger' as const, label: 'Zona Berbahaya', glyph: '⚠', critical: true },
  ];

  return (
    <PlatformShell
      active="apps"
      user={user}
      title="Pengaturan Aplikasi"
      toolbar={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[11px] text-[var(--text-tertiary)] tracking-tight truncate">
              — {app.name}
            </span>
          </div>
          <div className="w-[26px] h-[26px] rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)] flex items-center justify-center text-[11px] font-mono font-semibold shrink-0 border border-[var(--border-standard)]">
            {user.name.split(/\s+/).map((w) => w[0].toUpperCase()).slice(0, 2).join('') || 'U'}
          </div>
        </div>
      }
    >
      <div className="relative flex flex-row h-full min-h-full">
        {/* NAV TAB KIRI 200px */}
        <nav className="w-[200px] min-w-[200px] bg-[var(--surface-panel)] border-r border-[var(--border-standard)] py-4 flex flex-col gap-1 select-none">
          {NAV.map((n) => {
            const on = tab === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setTab(n.id)}
                aria-current={on ? 'page' : undefined}
                className={[
                  'text-left px-4 py-2 border-l-2 text-[13px] flex items-center gap-2 transition-colors',
                  on
                    ? n.critical
                      ? 'bg-[#fdecec] text-[var(--critical)] font-medium border-[var(--critical)]'
                      : 'bg-[var(--surface-accent-tint)] text-[var(--accent-hover)] font-medium border-[var(--accent-hover)]'
                    : n.critical
                      ? 'text-[var(--critical)] border-transparent hover:bg-[#fdecec]'
                      : 'text-[var(--text-secondary)] border-transparent hover:bg-[var(--surface-hover)]',
                ].join(' ')}
              >
                <span className="text-[16px] leading-none">{n.glyph}</span>
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>

        {/* PANE KANAN */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 pb-28">
          {error && (
            <div className="bg-[var(--critical-tint)] text-[var(--critical)] text-[13px] rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {tab === 'general' && (
            <form
              className="bg-[var(--surface-panel)] p-6 rounded-lg border border-[var(--border-standard)] space-y-5"
            >
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h2 className="text-[1rem] font-semibold text-[var(--text-primary)]">General</h2>
                <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
                  Informasi dasar dan visibilitas aplikasi.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="app-name" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
                    Nama Aplikasi
                  </label>
                  <input
                    id="app-name"
                    type="text"
                    value={name}
                    disabled={!canEdit}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[6px] text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all disabled:opacity-60"
                  />
                </div>

                <div>
                  <label htmlFor="app-slug" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
                    Slug Aplikasi
                  </label>
                  <div className="flex items-center h-10 border border-[var(--border-standard)] rounded-[6px] bg-[var(--surface-panel)] overflow-hidden">
                    <span className="px-3 bg-[var(--surface-page)] text-[var(--text-tertiary)] font-mono text-[12px] border-r border-[var(--border-standard)] h-full flex items-center select-none">
                      app.portico.internal/
                    </span>
                    <input
                      id="app-slug"
                      type="text"
                      value={app.slug}
                      readOnly
                      className="flex-1 h-full px-3 font-mono text-[13px] text-[var(--text-primary)] border-none focus:ring-0 bg-transparent"
                    />
                  </div>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-1.5">
                    Slug dipakai untuk tautan publik dan tidak ikut berubah saat aplikasi diarsipkan.
                  </p>
                </div>

                <div>
                  <label htmlFor="app-desc" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
                    Deskripsi
                  </label>
                  <textarea
                    id="app-desc"
                    rows={3}
                    value={description}
                    disabled={!canEdit}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[6px] text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all resize-none disabled:opacity-60"
                  />
                </div>

                {/* Status arsip — not in the reference mock; composed from the
                    panel/label/button tokens already used on this screen. */}
                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">
                        {archived ? 'Aplikasi diarsipkan' : 'Arsipkan aplikasi'}
                      </span>
                      <span className="text-[12px] text-[var(--text-tertiary)]">
                        {archived
                          ? 'Tautan publiknya mati. Datanya masih utuh dan bisa dipulihkan dengan slug yang sama.'
                          : 'Aplikasi hilang dari daftar utama dan tautan publiknya berhenti bekerja. Data tidak terhapus.'}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => (archived ? setArchived(false) : setConfirmArchive(true))}
                        className="h-8 px-3 rounded-[6px] text-[12px] font-medium border border-[var(--border-standard)] bg-[var(--surface-panel)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shrink-0"
                      >
                        {archived ? 'Pulihkan' : 'Arsipkan'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </form>
          )}

          {tab === 'danger' && (
            <section className="bg-[var(--surface-panel)] p-6 rounded-lg border border-[#fdecec] space-y-4">
              <div>
                <h2 className="text-[1rem] font-semibold text-[var(--critical)]">Hapus aplikasi</h2>
              </div>
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                Tindakan ini tidak dapat dibatalkan.{' '}
                <span className="font-mono font-medium text-[var(--text-primary)]">{counts.pages} halaman</span>,{' '}
                <span className="font-mono font-medium text-[var(--text-primary)]">{counts.components} komponen</span>{' '}
                dan{' '}
                <span className="font-mono font-medium text-[var(--text-primary)]">{counts.rows} baris data</span>{' '}
                akan ikut terhapus permanen.
              </p>
              <div className="pt-1">
                <label htmlFor="delete-confirmation" className="block text-[12px] text-[var(--text-secondary)] mb-1.5">
                  Ketik <span className="font-mono font-bold text-[var(--text-primary)]">{app.slug}</span> untuk
                  mengonfirmasi:
                </label>
                <input
                  id="delete-confirmation"
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={app.slug}
                  className="h-10 w-80 px-3 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[6px] font-mono text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--critical)] focus:ring-1 focus:ring-[var(--critical)] transition-all"
                />
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  disabled={!isAdmin || typed !== app.slug}
                  onClick={() => setConfirmDelete(true)}
                  className="bg-[var(--critical)] hover:opacity-90 text-white px-4 py-2 text-[13px] font-semibold rounded-[6px] transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Hapus permanen
                </button>
                {!isAdmin && (
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-2">
                    Hanya admin yang bisa menghapus permanen.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Save confirmation. The export has no toast component, so this reuses
              the status-row pattern the same screen already draws for its data
              sources (bg-success dot + text-success mono value) instead of
              inventing a new surface. It is the only feedback AC1 has. */}
          {saved && !dirty && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
              <span className="text-[13px] font-medium text-[var(--text-primary)]">
                Tersimpan
              </span>
              <span className="font-mono text-[12px] text-[var(--success)]">
                diubah {new Date(saved).toLocaleString('id-ID')}
              </span>
            </div>
          )}
        </div>

        {/* Sticky bar "Perubahan belum disimpan" — the reference draws it
            docked at the bottom of the pane (shadow-[0_8px_24px], warning dot,
            Batal / Simpan Perubahan). It is also the only save control this
            screen has, so it appears exactly when there is something to save. */}
        {tab === 'general' && dirty && (
          <div className="absolute bottom-4 left-[224px] right-6 z-20 pointer-events-auto">
            <div className="bg-[var(--surface-panel)] border border-[var(--border-standard)] shadow-[0_8px_24px_rgba(15,23,42,0.12)] rounded-lg px-5 py-3 flex items-center justify-between">
              <div className="flex items-center min-w-0">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)] inline-block mr-2.5 shrink-0" />
                <span className="text-[13px] font-medium text-[var(--text-primary)] mr-1.5">
                  Perubahan belum disimpan
                </span>
                <span className="text-[12px] text-[var(--text-tertiary)] truncate">
                  ({changedFields.length} modifikasi pada {changedFields.join(', ')})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={reset}
                  className="px-3 py-1.5 text-[13px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] rounded-[6px] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-1.5 text-[13px] font-semibold bg-[var(--accent-hover)] text-white rounded-[6px] shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50"
                >
                  {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={confirmArchive}
        title={`Arsipkan ${app.name}?`}
        description="Aplikasi hilang dari daftar utama dan tautan publiknya berhenti bekerja. Halaman, komponen, workflow, dan baris datanya tidak terhapus — bisa dipulihkan dengan slug yang sama."
        onClose={() => setConfirmArchive(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmArchive(false)}
              className="h-8 px-3 rounded-[6px] text-[12px] border border-[var(--border-standard)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => setArchived(true)}
              className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              Arsipkan
            </button>
          </>
        }
      />

      <Modal
        open={confirmDelete}
        title={`Hapus permanen ${app.name}?`}
        description={`${counts.pages} halaman, ${counts.components} komponen, ${counts.rows} baris data ikut terhapus dan tidak bisa dikembalikan.`}
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="h-8 px-3 rounded-[6px] text-[12px] border border-[var(--border-standard)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={destroy}
              className="h-8 px-3 rounded-[6px] text-[12px] font-medium bg-[var(--critical)] text-white hover:opacity-90 transition-opacity"
            >
              Hapus permanen
            </button>
          </>
        }
      />
    </PlatformShell>
  );
}
