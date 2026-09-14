'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.message ?? 'Gagal masuk.');
        return;
      }
      router.push('/apps');
      router.refresh();
    } catch {
      setError('Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-page)] p-4">
      <div className="w-full max-w-[380px] bg-[var(--surface-panel)] rounded-lg border border-[var(--border-standard)] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.08)] p-6">
        {/* Wordmark */}
        <div className="mb-6">
          <h1 className="text-[1.25rem] leading-[1.33] font-semibold text-[var(--text-primary)] tracking-[-0.24px]">Platform</h1>
        </div>

        {/* Tombol sekunder full-width "Masuk lewat Hub" */}
        <div className="mb-5">
          <a
            href="/api/auth/hub/start"
            className="w-full h-10 px-3.5 bg-[var(--surface-panel)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[0.813rem] font-medium rounded-[6px] border border-[var(--border-standard)] transition-colors flex items-center justify-center gap-2"
          >
            Masuk lewat Hub
          </a>
        </div>

        {/* Pemisah "atau login lokal" */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="w-full border-t border-[var(--border-standard)]" />
          <span className="absolute bg-[var(--surface-panel)] px-2.5 text-[12px] leading-none text-[var(--text-tertiary)] font-normal">atau login lokal</span>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-md bg-[var(--critical-tint)] text-[var(--critical)] text-sm">
            {error}
          </div>
        )}

        {/* Form login lokal */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[0.75rem] font-medium text-[var(--text-tertiary)] mb-1.5 leading-normal">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--surface-panel)] text-[var(--text-primary)] placeholder-[var(--text-quaternary)] text-[0.875rem] rounded-[6px] border border-[var(--border-standard)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-[0.75rem] font-medium text-[var(--text-tertiary)] mb-1.5 leading-normal">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--surface-panel)] text-[var(--text-primary)] placeholder-[var(--text-quaternary)] text-[0.875rem] rounded-[6px] border border-[var(--border-standard)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
            />
          </div>
          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[0.813rem] font-medium rounded-[6px] transition-colors flex items-center justify-center disabled:opacity-60"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <a href="/register" className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            Belum punya akun? Daftar
          </a>
        </div>
      </div>
    </div>
  );
}