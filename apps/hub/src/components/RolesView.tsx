'use client';

import { useEffect, useState } from 'react';
import { HubShell } from './HubShell';

/**
 * Hub Roles — per-app vocabulary + read-only permission matrix (US-M11 AC4/AC5).
 *
 * The matrix is deliberately inert: cells are not inputs and there is a visible
 * caption saying so. An editable-looking grid that silently ignores clicks is
 * worse than no grid.
 *
 * Access control lives in the page (server) that renders this.
 */
interface AppRoles {
  appId: string;
  appName: string;
  roles: string[];
  holders: { role: string; count: number }[];
}
interface Matrix {
  readOnly: boolean;
  caption: string;
  capabilities: { key: string; label: string }[];
  cells: Record<string, Record<string, string[]>>;
}

export function RolesView() {
  const [apps, setApps] = useState<AppRoles[] | null>(null);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hub/roles', { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = '/login?next=/peran';
          return;
        }
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? 'Gagal memuat peran.');
        setApps(d.apps);
        setMatrix(d.matrix);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <HubShell title="Peran">
      <h1 className="heading-section mb-2">Peran</h1>
      <p className="text-sm text-[var(--text-tertiary)] mb-5">
        Peran dikelola per-aplikasi. Satu pengguna bisa punya peran berbeda di tiap aplikasi.
      </p>

      {error && <p role="alert" className="text-[0.813rem] text-[var(--critical)]">{error}</p>}
      {!apps && !error && <p className="text-[0.813rem] text-[var(--text-tertiary)]">Memuat…</p>}

      {apps && (
        <div className="flex flex-col gap-6">
          {apps.map((a) => (
            <section key={a.appId} data-app={a.appId}>
              <h2 className="heading-card mb-2">{a.appName}</h2>
              <div className="flex flex-wrap gap-2">
                {a.roles.map((role) => {
                  const held = a.holders.find((h) => h.role === role);
                  return (
                    <span
                      key={role}
                      className="inline-flex items-center gap-2 h-7 px-2.5 rounded-md text-[0.75rem] font-medium bg-[var(--surface-sunken)] text-[var(--text-primary)]"
                    >
                      {role}
                      <span className="text-[var(--text-tertiary)] font-normal">
                        {held ? `${held.count} user` : 'kosong'}
                      </span>
                    </span>
                  );
                })}
              </div>

              {matrix?.cells[a.appId] && (
                <div className="mt-3">
                  <p className="text-[0.75rem] text-[var(--text-tertiary)] mb-2" data-testid={`caption-${a.appId}`}>
                    {matrix.caption}
                  </p>
                  <table className="w-full text-sm border-collapse" data-testid={`matrix-${a.appId}`}>
                    <thead>
                      <tr className="h-9 border-b border-[var(--border-standard)]">
                        <th className="text-left font-medium text-[var(--text-tertiary)] text-[0.75rem] px-3">Peran</th>
                        {matrix.capabilities.map((c) => (
                          <th key={c.key} className="text-left font-medium text-[var(--text-tertiary)] text-[0.75rem] px-3">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(matrix.cells[a.appId]).map(([role, caps]) => (
                        <tr key={role} className="h-9 border-b border-[var(--border-subtle)]">
                          <td className="px-3 text-[var(--text-primary)]">{role}</td>
                          {matrix.capabilities.map((c) => (
                            <td key={c.key} className="px-3">
                              {/* Inert by design — AC5: clicking a cell changes nothing. */}
                              <span
                                role="img"
                                aria-label={caps.includes(c.key) ? 'boleh' : 'tidak'}
                                data-cell={`${a.appId}:${role}:${c.key}`}
                                data-allowed={caps.includes(c.key) ? 'true' : 'false'}
                                className="inline-block w-4 h-4 rounded-[4px]"
                                style={{
                                  background: caps.includes(c.key) ? 'var(--accent)' : 'var(--surface-sunken)',
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </HubShell>
  );
}
