'use client';

/**
 * SettingsView — workspace settings, "Anggota" tab.
 *
 * Cloned class-for-class from
 *   docs/stitch_output/stitch_portico_full_ui_set/platform_pengaturan_workspace/code.html
 *
 * Layout (all values read off the reference, not invented):
 *   rail 56 · sidebar 236 · top bar 48 · tab column 200 · table card
 *   toolbar 44px · header row 36px · body rows 48px · footer 40px · dirty bar 56px
 *
 * The reference draws a per-row `more_vert` button with no menu and a
 * "Perubahan belum disimpan" bar with Batal/Simpan, i.e. a staged-save model.
 * Both are implemented: the row menu opens the suite Modal, role changes are
 * staged locally and committed by Simpan.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlatformShell } from './PlatformShell';
import { Modal } from '@portico/ui/modal';
import { IconSearch, IconPersonAdd, IconMoreVertical, IconCheckCircle } from '@portico/ui/icons';

type Role = 'admin' | 'builder' | 'viewer';

interface Member {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
}

type Row =
  | ({ kind: 'member' } & Member)
  | ({ kind: 'invite' } & Invitation);

/** The reference's five tab labels, in order, with "Anggota" active. */
const TABS = ['General', 'Anggota', 'Peran', 'Kredensial', 'Integrasi'] as const;

export function SettingsView({ user }: { user: { id: string; name: string; role: string } }) {
  const [tab, setTab] = useState<string>('Anggota');
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Staged role changes — the reference commits them with Simpan, so the
  // dirty bar appears only when this map is non-empty.
  const [staged, setStaged] = useState<Record<string, Role>>({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState('');

  // Modals
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('viewer');
  const [inviteError, setInviteError] = useState('');
  const [menuRow, setMenuRow] = useState<Row | null>(null);
  const [removeRow, setRemoveRow] = useState<Row | null>(null);

  const isAdmin = user.role === 'admin';
  const adminCount = members.filter((m) => m.role === 'admin').length;

  const load = useCallback(async () => {
    try {
      const [m, i] = await Promise.all([
        fetch('/api/orgs/members'),
        fetch('/api/orgs/invitations'),
      ]);
      if (m.ok) setMembers((await m.json()).members ?? []);
      if (i.ok) setInvitations((await i.json()).invitations ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows: Row[] = useMemo(() => {
    const all: Row[] = [
      ...members.map((m) => ({ kind: 'member' as const, ...m })),
      ...invitations.map((i) => ({ kind: 'invite' as const, ...i })),
    ];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) => r.email.toLowerCase().includes(q)
        || (r.kind === 'member' && r.name.toLowerCase().includes(q)),
    );
  }, [members, invitations, search]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    const email = inviteEmail.trim().toLowerCase();
    const res = await fetch('/api/orgs/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    if (res.ok) {
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      setBanner(`Undangan terkirim ke ${email}.`);
      await load();
    } else {
      // AC4: the server's own wording, shown where the user is looking.
      setInviteError((await res.json().catch(() => ({}))).message ?? 'Gagal mengundang.');
    }
  }

  async function commitStaged() {
    setSaving(true);
    setBanner('');
    try {
      for (const [id, role] of Object.entries(staged)) {
        await fetch(`/api/orgs/members/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        });
      }
      setStaged({});
      await load();
      setBanner('Perubahan peran tersimpan.');
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(row: Row) {
    const res = await fetch(`/api/orgs/members/${row.id}`, { method: 'DELETE' });
    if (res.ok) {
      setRemoveRow(null);
      setMenuRow(null);
      await load();
    }
  }

  async function resendInvite(row: Row) {
    await fetch(`/api/orgs/invitations/${row.id}/resend`, { method: 'POST' });
    setMenuRow(null);
    await load();
  }

  async function cancelInvite(row: Row) {
    await fetch(`/api/orgs/invitations/${row.id}`, { method: 'DELETE' });
    setMenuRow(null);
    await load();
  }

  const stagedCount = Object.keys(staged).length;

  return (
    <PlatformShell active="settings" user={user} title="Pengaturan">
      <div className="flex h-full min-h-0">
        {/* NAV TAB KIRI 200px */}
        <aside className="w-[200px] min-w-[200px] h-full bg-[#ffffff] border-r border-[rgba(15,23,42,0.10)] py-4 px-2 flex flex-col gap-0.5 shrink-0 select-none">
          {TABS.map((t) => {
            const on = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-current={on ? 'page' : undefined}
                className={[
                  'relative flex items-center px-3 py-2 text-[13px] rounded-md text-left transition-colors',
                  on
                    ? 'font-[560] bg-[#f2f0fe] text-[#5b46d6]'
                    : 'text-[#4b5058] hover:bg-[#f1f1f3] hover:text-[#101014]',
                ].join(' ')}
              >
                {on && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[#5b46d6] rounded-r" />
                )}
                {t}
              </button>
            );
          })}
        </aside>

        {/* PANE KANAN */}
        <main className="flex-1 h-full min-w-0 overflow-y-auto bg-[#f7f7f8] flex flex-col justify-between pb-16">
          {tab !== 'Anggota' ? (
            <div className="p-6 max-w-6xl w-full mx-auto">
              <p className="text-[13px] text-[#62676f]">
                Tab {tab} belum diisi pada iterasi ini.
              </p>
            </div>
          ) : (
            <div className="p-6 max-w-6xl w-full mx-auto">
              <div className="bg-[#ffffff] border border-[rgba(15,23,42,0.10)] rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                {/* BARIS ALAT 44px */}
                <div className="h-11 px-4 border-b border-[rgba(15,23,42,0.10)] bg-[#ffffff] flex items-center justify-between gap-4">
                  <div className="relative w-64">
                    <IconSearch size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aa0aa]" />
                    <input
                      type="text"
                      placeholder="Cari nama atau surel..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-7 pl-8 pr-2.5 text-[12px] bg-[#f7f7f8] border border-[rgba(15,23,42,0.08)] rounded-md text-[#101014] placeholder-[#9aa0aa] focus:outline-none focus:border-[#6e5ae6] focus:bg-[#ffffff] transition-all"
                    />
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { setInviteOpen(true); setInviteError(''); setBanner(''); }}
                      className="h-7 px-3 rounded-md bg-[#6e5ae6] hover:bg-[#5b46d6] text-[#ffffff] text-[12px] font-[560] flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <IconPersonAdd size={15} className="text-[15px]" />
                      <span>Undang anggota</span>
                    </button>
                  )}
                </div>

                {banner && (
                  <div className="h-9 px-4 flex items-center gap-2 border-b border-[rgba(15,23,42,0.10)] bg-[#f0fdf4] text-[12px] text-[#15803d]">
                    <IconCheckCircle size={15} className="text-[15px]" />
                    {banner}
                  </div>
                )}

                {loading ? (
                  <div className="h-24 flex items-center justify-center text-[13px] text-[#62676f]">
                    Memuat...
                  </div>
                ) : rows.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-[13px] text-[#62676f]">
                    Tidak ada anggota yang cocok.
                  </div>
                ) : (
                  <MembersTable
                    rows={rows}
                    user={user}
                    staged={staged}
                    setStaged={setStaged}
                    onMenu={setMenuRow}
                    adminCount={adminCount}
                  />
                )}

                {/* Table footer */}
                <div className="h-10 px-4 border-t border-[rgba(15,23,42,0.10)] bg-[#ffffff] flex items-center justify-between text-[12px] text-[#62676f]">
                  <span>
                    Menampilkan {rows.length ? `1–${rows.length}` : '0'} dari {rows.length} anggota
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button disabled className="px-2 py-1 text-[11px] rounded border border-[rgba(15,23,42,0.10)] text-[#9aa0aa] bg-[#f7f7f8] cursor-not-allowed">
                      Sebelumnya
                    </button>
                    <button className="px-2 py-1 text-[11px] rounded border border-[rgba(15,23,42,0.10)] text-[#101014] bg-[#ffffff] font-medium">
                      1
                    </button>
                    <button disabled className="px-2 py-1 text-[11px] rounded border border-[rgba(15,23,42,0.10)] text-[#9aa0aa] bg-[#f7f7f8] cursor-not-allowed">
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STICKY BAR BAWAH */}
          {stagedCount > 0 && (
            <div className="fixed bottom-0 left-[292px] right-0 h-14 bg-[#ffffff] border-t border-[rgba(15,23,42,0.10)] px-6 flex items-center justify-between z-40 shadow-[0_-2px_10px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#d97706] animate-pulse" />
                <span className="text-[13px] font-[500] text-[#101014]">Perubahan belum disimpan</span>
                <span className="text-[12px] text-[#62676f] ml-1 hidden sm:inline">
                  ({stagedCount} peran anggota dimodifikasi)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStaged({})}
                  className="h-8 px-3 rounded-md text-[13px] font-[500] text-[#4b5058] hover:bg-[#f1f1f3] hover:text-[#101014] border border-[rgba(15,23,42,0.10)] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={commitStaged}
                  className="h-8 px-3 rounded-md text-[13px] font-[560] bg-[#6e5ae6] hover:bg-[#5b46d6] text-[#ffffff] transition-colors disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Modals (never window.confirm/prompt) ─────────────────────────── */}

      <Modal
        open={inviteOpen}
        title="Undang anggota"
        description="Kirim undangan ke alamat email. Peran ditentukan di sini dan berlaku saat undangan diterima."
        onClose={() => setInviteOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="h-8 px-3 rounded-md text-[13px] font-[500] text-[#4b5058] hover:bg-[#f1f1f3] border border-[rgba(15,23,42,0.10)] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              form="invite-form"
              className="h-8 px-3 rounded-md text-[13px] font-[560] bg-[#6e5ae6] hover:bg-[#5b46d6] text-[#ffffff] transition-colors"
            >
              Kirim undangan
            </button>
          </>
        }
      >
        <form id="invite-form" onSubmit={sendInvite} className="space-y-3">
          <div>
            <label htmlFor="invite-email" className="block text-[12px] font-[560] text-[#4b5058] mb-1">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full h-9 px-3 text-[13px] rounded-md border border-[rgba(15,23,42,0.10)] bg-[#ffffff] text-[#101014] outline-none focus:border-[#6e5ae6]"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-[12px] font-[560] text-[#4b5058] mb-1">
              Peran
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="w-full h-9 px-2 text-[13px] rounded-md border border-[rgba(15,23,42,0.10)] bg-[#ffffff] text-[#101014] outline-none focus:border-[#6e5ae6]"
            >
              <option value="viewer">viewer — hanya melihat</option>
              <option value="builder">builder — membangun aplikasi</option>
              <option value="admin">admin — kelola anggota</option>
            </select>
          </div>
          {inviteError && (
            <p role="alert" className="text-[12px] text-[#b91c1c]">
              {inviteError}
            </p>
          )}
        </form>
      </Modal>

      {/* Row menu — the reference's more_vert */}
      <Modal
        open={!!menuRow}
        title={menuRow?.kind === 'invite' ? 'Undangan tertunda' : 'Kelola anggota'}
        description={menuRow?.email}
        onClose={() => setMenuRow(null)}
        footer={
          <button
            type="button"
            onClick={() => setMenuRow(null)}
            className="h-8 px-3 rounded-md text-[13px] font-[500] text-[#4b5058] hover:bg-[#f1f1f3] border border-[rgba(15,23,42,0.10)] transition-colors"
          >
            Tutup
          </button>
        }
      >
        <div className="flex flex-col gap-1">
          {menuRow?.kind === 'invite' ? (
            <>
              <button
                type="button"
                onClick={() => resendInvite(menuRow)}
                className="h-9 px-3 rounded-md text-left text-[13px] text-[#101014] hover:bg-[#f1f1f3] transition-colors"
              >
                Kirim ulang undangan (perpanjang 24 jam)
              </button>
              <button
                type="button"
                onClick={() => { setRemoveRow(menuRow); setMenuRow(null); }}
                className="h-9 px-3 rounded-md text-left text-[13px] text-[#b91c1c] hover:bg-[#fef2f2] transition-colors"
              >
                Batalkan undangan
              </button>
            </>
          ) : (
            <>
              {/* US-A04 AC3 — change a member's role. Staged locally, committed
                  by Simpan, so the reference's "Perubahan belum disimpan" bar is
                  what actually writes it. */}
              {isAdmin && menuRow?.kind === 'member' && menuRow.id !== user.id && (
                <>
                  <span className="px-3 pt-1 pb-0.5 text-[11px] font-mono uppercase tracking-wider text-[#9aa0aa]">
                    Ubah peran
                  </span>
                  {(['viewer', 'builder', 'admin'] as Role[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setStaged((prev) => ({ ...prev, [menuRow.id]: role }));
                        setMenuRow(null);
                      }}
                      className={[
                        'h-9 px-3 rounded-md text-left text-[13px] transition-colors',
                        menuRow.role === role
                          ? 'bg-[#f2f0fe] text-[#5b46d6] font-[560]'
                          : 'text-[#101014] hover:bg-[#f1f1f3]',
                      ].join(' ')}
                    >
                      {role}
                      {menuRow.role === role ? ' — peran saat ini' : ''}
                    </button>
                  ))}
                </>
              )}
              <button
                type="button"
                onClick={() => { setRemoveRow(menuRow); setMenuRow(null); }}
                className="h-9 px-3 rounded-md text-left text-[13px] text-[#b91c1c] hover:bg-[#fef2f2] transition-colors"
              >
                Cabut akses anggota ini
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Destructive confirmation — a real Modal, never window.confirm() */}
      <Modal
        open={!!removeRow}
        title={removeRow?.kind === 'invite' ? 'Batalkan undangan?' : 'Cabut akses anggota?'}
        description={
          removeRow?.kind === 'invite'
            ? `Undangan untuk ${removeRow?.email} akan dibatalkan. Tautannya tidak bisa dipakai lagi.`
            : `${removeRow?.email} akan kehilangan akses ke workspace ini. Tindakan ini tidak bisa dibatalkan.`
        }
        onClose={() => setRemoveRow(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRemoveRow(null)}
              className="h-8 px-3 rounded-md text-[13px] font-[500] text-[#4b5058] hover:bg-[#f1f1f3] border border-[rgba(15,23,42,0.10)] transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => removeRow && (removeRow.kind === 'invite' ? cancelInvite(removeRow) : removeMember(removeRow))}
              className="h-8 px-3 rounded-md text-[13px] font-[560] bg-[#dc2626] hover:bg-[#b91c1c] text-[#ffffff] transition-colors"
            >
              {removeRow?.kind === 'invite' ? 'Batalkan undangan' : 'Cabut akses'}
            </button>
          </>
        }
      />
    </PlatformShell>
  );
}

/** Avatar initials, exactly as the reference renders them (26px, 11px/560). */
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

/**
 * The member table: header 36px mono-label, body rows 48px, name cell with a
 * 26px initials avatar. Role badges follow the reference's two variants —
 * admin gets the accent tint, everyone else the sunken grey.
 */
function MembersTable({
  rows, user, staged, setStaged, onMenu, adminCount,
}: {
  rows: Row[];
  user: { id: string; name: string; role: string };
  staged: Record<string, Role>;
  setStaged: React.Dispatch<React.SetStateAction<Record<string, Role>>>;
  onMenu: (r: Row) => void;
  adminCount: number;
}) {
  const isAdmin = user.role === 'admin';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="h-9 bg-[#f7f7f8] border-b border-[rgba(15,23,42,0.10)] text-[11px] font-mono uppercase tracking-wider text-[#62676f]">
            <th className="px-4 font-[500] w-[240px]">Nama</th>
            <th className="px-4 font-[500] w-[240px]">Email</th>
            <th className="px-4 font-[500] w-[140px]">Peran</th>
            <th className="px-4 font-[500] w-[160px]">Status</th>
            <th className="px-4 font-[500] text-right w-[160px]">Terakhir Aktif</th>
            <th className="px-4 font-[500] text-right w-[80px]">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(15,23,42,0.10)] text-[13px]">
          {rows.map((r) => {
            const isSelf = r.kind === 'member' && r.id === user.id;
            const shown = (staged[r.id] ?? r.role) as Role;
            // "Admin terakhir": the reference protects the sole admin's row.
            const locked = isSelf && r.kind === 'member' && r.role === 'admin' && adminCount === 1;
            return (
              <tr key={`${r.kind}-${r.id}`} className="h-12 bg-[#ffffff] hover:bg-[#f1f1f3] transition-colors">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-[26px] h-[26px] rounded-full bg-[#ededf0] text-[#4b5058] text-[11px] font-[560] flex items-center justify-center shrink-0">
                      {initials(r.kind === 'member' ? r.name : r.email)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-[500] text-[#101014] leading-tight truncate">
                        {r.kind === 'member' ? r.name : r.email}
                      </span>
                      {isSelf && <span className="text-[11px] text-[#62676f] leading-tight">Anda</span>}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-2 font-mono text-[12px] text-[#4b5058] truncate max-w-[240px]">
                  {r.email}
                </td>

                <td className="px-4 py-2">
                  <span className={[
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px]',
                    shown === 'admin' ? 'font-[560] bg-[#f2f0fe] text-[#5b46d6]' : 'font-[500] bg-[#ededf0] text-[#4b5058]',
                  ].join(' ')}>
                    {shown}
                  </span>
                </td>

                <td className="px-4 py-2">
                  {r.kind === 'member' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-[500] bg-[#e8f6ee] text-[#15803d]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-[500] bg-[#fdf1e3] text-[#b45309]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
                      Menunggu undangan
                    </span>
                  )}
                </td>

                <td className={`px-4 py-2 font-mono text-[12px] text-right ${r.kind === 'member' ? 'text-[#4b5058]' : 'text-[#9aa0aa]'}`}>
                  {r.kind === 'member' ? 'Sekarang' : '—'}
                </td>

                {/* Aksi — the reference draws ONLY a more_vert button here, plus an
                    italic note under it when the row is the last admin. No inline
                    role control: that would be chrome the design does not have. The
                    menu behind more_vert is where US-A04 AC3's role change lives. */}
                <td className="px-4 py-2 text-right relative">
                  {locked ? (
                    <div className="inline-flex flex-col items-end">
                      <button
                        disabled
                        title="Admin terakhir tidak bisa diturunkan"
                        className="p-1 rounded text-[#9aa0aa] cursor-not-allowed opacity-60"
                      >
                        <IconMoreVertical size={18} />
                      </button>
                      <span className="text-[10px] text-[#62676f] italic block text-right mt-0.5">
                        Admin terakhir tidak bisa diturunkan
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMenu(r)}
                      title="Aksi anggota"
                      className="p-1 rounded hover:bg-[#ededf0] text-[#62676f] transition-colors"
                    >
                      <IconMoreVertical size={18} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
