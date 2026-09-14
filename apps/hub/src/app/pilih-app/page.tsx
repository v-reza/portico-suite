'use client';

import { useEffect, useState } from 'react';
import { IconLayers, IconSupport, IconTerminal, IconChevronRight } from '@portico/ui/icons';

/**
 * Pilih App — 560px centred card, NO app shell.
 *
 * Reads the app list from the live Hub API rather than a hardcoded array, so
 * revoking access (US-M11 AC2) actually changes this screen: a denied app renders
 * disabled with a readable reason instead of disappearing.
 */
interface AppAccess {
  appId: string;
  appName: string;
  allowed: boolean;
  role: string | null;
  reason?: string;
}

const ICONS: Record<string, typeof IconLayers> = {
  platform: IconLayers,
  helpdesk: IconSupport,
  'code-review': IconTerminal,
  portico_hub: IconLayers,
};

const DESCRIPTIONS: Record<string, string> = {
  platform: 'Bangun alur kerja AI tanpa kode',
  helpdesk: 'Kelola tiket dukungan pelanggan',
  'code-review': 'Tinjau kubah secara kolaboratif',
  portico_hub: 'Control plane Portico',
};

const BASE: Record<string, string> = {
  platform: 'http://localhost:3001',
  helpdesk: 'http://localhost:3002',
  'code-review': 'http://localhost:3003',
};

export default function PilihAppPage() {
  const [apps, setApps] = useState<AppAccess[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hub/apps', { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = '/login?next=/pilih-app';
          return;
        }
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? 'Gagal memuat daftar aplikasi.');
        setApps(data.apps);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="bg-[var(--surface-page)] min-h-screen flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-[560px] bg-[var(--surface-panel)] rounded-lg p-6 hairline-border card-shadow">
        <header className="mb-5">
          <h1 className="heading-section">Lanjutkan ke aplikasi</h1>
        </header>

        {error && (
          <p role="alert" className="text-[0.813rem] text-[var(--critical)]">{error}</p>
        )}

        {!apps && !error && (
          <p className="text-[0.813rem] text-[var(--text-tertiary)]">Memuat…</p>
        )}

        {apps && (
          <section className="flex flex-col gap-3" aria-label="Daftar Aplikasi">
            {apps.map((a) => {
              const Icon = ICONS[a.appId] ?? IconLayers;
              const href = `${BASE[a.appId] ?? ''}/api/auth/hub/start?redirect=${a.appId}`;
              const body = (
                <>
                  <span
                    className={`w-9 h-9 shrink-0 rounded-md flex items-center justify-center ${
                      a.allowed
                        ? 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]'
                        : 'bg-[var(--surface-page)] text-[var(--text-quaternary)]'
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`app-title block truncate ${a.allowed ? '' : 'text-[var(--text-quaternary)]'}`}>
                      {a.appName}
                    </span>
                    <span className="app-desc block truncate">
                      {a.allowed ? DESCRIPTIONS[a.appId] ?? '' : a.reason ?? 'Akses dicabut oleh admin.'}
                    </span>
                  </span>
                  {a.allowed ? (
                    <IconChevronRight size={18} className="shrink-0 text-[var(--text-quaternary)] group-hover:text-[var(--text-primary)] transition-colors" />
                  ) : (
                    <span className="shrink-0 text-[0.75rem] font-medium text-[var(--text-quaternary)]">Tidak tersedia</span>
                  )}
                </>
              );

              return a.allowed ? (
                <a
                  key={a.appId}
                  href={href}
                  data-app={a.appId}
                  data-allowed="true"
                  className="group flex items-center justify-between gap-4 w-full bg-[var(--surface-panel)] rounded-lg p-4 hairline-border card-shadow hover:bg-[var(--surface-hover)] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                >
                  {body}
                </a>
              ) : (
                // Disabled, but rendered — not hidden (US-M11 AC1/AC2).
                <div
                  key={a.appId}
                  data-app={a.appId}
                  data-allowed="false"
                  aria-disabled="true"
                  className="flex items-center justify-between gap-4 w-full bg-[var(--surface-page)] rounded-lg p-4 hairline-border opacity-70 cursor-not-allowed"
                >
                  {body}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
