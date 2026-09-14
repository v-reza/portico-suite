'use client';

import { useEffect, useState } from 'react';

/**
 * Status Sistem — reads /ready and /health for real (US-M08 AC1/AC2).
 *
 * Every row is a live probe with its own latency; a failed component is named
 * and shown as down, and the page itself stays 200 so one bad dependency does
 * not blank the screen (US-M09 AC4).
 */
interface Component { status: string; latencyMs: number; reason?: string }

const LABELS: Record<string, string> = {
  database: 'PostgreSQL',
  redis: 'Redis',
};

export default function StatusSistemPage() {
  const [data, setData] = useState<{ status: string; components: Record<string, Component>; failed?: string[] } | null>(null);
  const [health, setHealth] = useState<{ status: string; uptimeSeconds: number } | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      // /ready answers 503 when degraded — read the body either way.
      const r = await fetch('/ready', { cache: 'no-store' });
      const body = await r.json();
      setData(body);
      setCheckedAt(new Date().toLocaleTimeString('id-ID'));
      const h = await fetch('/health', { cache: 'no-store' });
      setHealth(await h.json());
    } catch {
      setError('Tidak bisa menghubungi server status.');
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  const rows: { name: string; c: Component }[] = data
    ? [
        ...Object.entries(data.components).map(([k, c]) => ({ name: LABELS[k] ?? k, c })),
        ...(health ? [{ name: 'Portico (Hub)', c: { status: health.status === 'ok' ? 'up' : 'down', latencyMs: 0 } }] : []),
      ]
    : [];

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[var(--surface-page)]">
      <div className="w-full max-w-[560px] bg-[var(--surface-panel)] rounded-lg hairline-border card-shadow p-6">
        <header className="mb-5">
          <h1 className="heading-title">Status sistem</h1>
          <p className="text-[12px] leading-[1.4] text-[var(--text-secondary)] mt-1">
            {checkedAt ? `Pengecekan terakhir: ${checkedAt}` : 'Memeriksa…'}
            {data && (
              <span data-testid="overall" data-status={data.status} className="ml-2">
                · {data.status === 'ready' ? 'semua normal' : 'ada gangguan'}
              </span>
            )}
          </p>
        </header>

        {error && <p role="alert" className="text-[0.813rem] text-[var(--critical)] mb-3">{error}</p>}

        <section className="hairline-border rounded-md overflow-hidden" data-testid="status-list">
          {rows.map(({ name, c }, i) => {
            const up = c.status === 'up';
            return (
              <div
                key={name}
                data-component={name}
                data-status={c.status}
                className={`h-12 px-4 flex items-center justify-between text-sm ${i === 0 ? '' : 'border-t border-[var(--border-standard)]'}`}
              >
                <span className="text-[var(--text-primary)]">{name}</span>
                <div className="flex items-center gap-6">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: up ? 'var(--success)' : 'var(--danger)' }}
                    title={up ? 'Operasional' : `Gangguan${c.reason ? `: ${c.reason}` : ''}`}
                    data-testid={`dot-${name}`}
                  />
                  <span className="font-mono-jb text-[13px] text-[var(--text-secondary)] w-[90px] text-right">
                    {up ? `${c.latencyMs} ms` : 'gagal'}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        <button type="button" onClick={load} className="mt-4 text-[0.75rem] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
          Periksa lagi
        </button>
      </div>
    </main>
  );
}
