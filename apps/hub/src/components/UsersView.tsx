'use client';

import { useEffect, useState } from 'react';
import { HubShell } from './HubShell';

/**
 * Hub Users — every user with a badge per app (US-M11 AC1).
 *
 * Badges for apps the user does NOT hold render grey rather than being omitted,
 * so an admin can see the gap. Role editing calls PUT /api/hub/roles, which
 * enforces the last-admin rule server-side.
 *
 * Access control lives in the page (server) that renders this — by the time this
 * component runs the caller is already authenticated.
 */
interface Access { appId: string; appName: string; allowed: boolean; role: string | null }
interface Row { id: string; email: string; name: string; active: boolean; lastLoginAt: string | null; access: Access[] }

const ELEVATED = new Set(['owner', 'admin', 'lead', 'supervisor']);

function relTime(iso: string | null): string {
  if (!iso) return 'Belum pernah';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export function UsersView() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [apps, setApps] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/hub/users', { cache: 'no-store' });
    if (r.status === 401) {
      // The session expired mid-session — the server guard already let us in, so
      // this is a real expiry, not an anonymous visitor.
      window.location.href = '/login?next=/pengguna';
      return;
    }
    const data = await r.json();
    if (!r.ok) throw new Error(data.message ?? 'Gagal memuat pengguna.');
    setRows(data.users);
    setApps(data.apps);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function changeRole(userId: string, appId: string, role: string | null) {
    setNotice(null);
    setError(null);
    const r = await fetch('/api/hub/roles', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, appId, role }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      // The last-admin refusal is a real business rule, not a crash — show it.
      setError(data.message ?? 'Gagal mengubah peran.');
      return;
    }
    setNotice(data.from ? `Peran diubah: ${data.from} → ${data.to ?? 'dicabut'}` : 'Peran diberikan.');
    await load();
  }

  return (
    <HubShell title="Pengguna">
      <h1 className="heading-section mb-4">Pengguna</h1>

      {error && <p role="alert" className="mb-3 text-[0.813rem] text-[var(--critical)]">{error}</p>}
      {notice && <p role="status" className="mb-3 text-[0.813rem] text-[var(--success)]">{notice}</p>}
      {!rows && !error && <p className="text-[0.813rem] text-[var(--text-tertiary)]">Memuat…</p>}

      {rows && (
        <table className="w-full text-sm border-collapse" data-testid="users-table">
          <thead>
            <tr className="h-10 border-b border-[var(--border-standard)]">
              <th className="text-left font-medium text-[var(--text-tertiary)] text-[0.75rem] px-3">Nama</th>
              {apps.map((a) => (
                <th key={a.id} className="text-left font-medium text-[var(--text-tertiary)] text-[0.75rem] px-3">
                  {a.name}
                </th>
              ))}
              <th className="text-left font-medium text-[var(--text-tertiary)] text-[0.75rem] px-3">Login terakhir</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="h-12 border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]" data-user={u.email}>
                <td className="px-3">
                  <div className="font-medium text-[var(--text-primary)]">{u.name}</div>
                  <div className="text-[0.75rem] text-[var(--text-tertiary)]">{u.email}</div>
                </td>
                {u.access.map((a) => (
                  <td key={a.appId} className="px-3">
                    <select
                      aria-label={`Peran ${u.email} di ${a.appName}`}
                      data-testid={`role-${u.email}-${a.appId}`}
                      value={a.allowed ? a.role ?? '' : ''}
                      onChange={(e) => changeRole(u.id, a.appId, e.target.value || null)}
                      className="h-7 rounded-md text-[0.75rem] font-medium px-2 border border-[var(--border-standard)] cursor-pointer"
                      style={
                        a.allowed && a.role && ELEVATED.has(a.role)
                          ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
                          : a.allowed
                            ? { background: 'var(--surface-sunken)', color: 'var(--text-primary)' }
                            : { background: 'var(--surface-page)', color: 'var(--text-quaternary)' }
                      }
                    >
                      <option value="">— tidak ada akses —</option>
                      <option value="viewer">viewer</option>
                      <option value="builder">builder</option>
                      <option value="agent">agent</option>
                      <option value="reviewer">reviewer</option>
                      <option value="supervisor">supervisor</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>
                  </td>
                ))}
                <td className="px-3 text-[var(--text-tertiary)]">{relTime(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </HubShell>
  );
}
