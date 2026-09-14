'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Hub login. Wired to POST /api/auth/login.
 *
 * `next` (set by /authorize when there is no session) is honoured after a
 * successful login so the SSO flow resumes instead of dead-ending.
 *
 * The demo credential block is required by US-M01 AC2: a reviewer without an
 * account must see plainly how to get in.
 */
export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/pilih-app';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hubDown, setHubDown] = useState(false);

  // Surface Hub reachability without blocking the form (US-M10 AC3).
  useEffect(() => {
    let alive = true;
    fetch('/health', { cache: 'no-store' })
      .then((r) => alive && setHubDown(!r.ok))
      .catch(() => alive && setHubDown(true));
    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Gagal masuk.');
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  function useDemo() {
    setEmail('demo@portico.dev');
    setPassword('demo1234');
    setError(null);
  }

  return (
    <main className="bg-[var(--surface-page)] flex items-center justify-center min-h-screen p-4 select-none">
      <div className="w-[380px] bg-[var(--surface-panel)] rounded-lg hairline-border card-shadow p-8 flex flex-col box-border">
        <h1 className="wordmark">Portico</h1>

        {hubDown && (
          <p
            role="status"
            className="mb-4 text-[0.75rem] leading-[1.4] text-[var(--warning)] bg-[var(--surface-sunken)] rounded-md px-3 py-2"
          >
            Koneksi ke server lambat. Login lokal tetap bisa dipakai.
          </p>
        )}

        <form className="flex flex-col gap-4 m-0" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="nama@email.com"
              autoComplete="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-[0.75rem] leading-[1.4] text-[var(--critical)] m-0">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Memproses…' : 'Masuk'}
          </button>
        </form>

        <div className="divider" />

        <div className="rounded-md bg-[var(--surface-sunken)] px-3 py-2.5">
          <p className="text-[0.75rem] leading-[1.4] text-[var(--text-secondary)] m-0">
            <strong className="font-medium text-[var(--text-primary)]">Akun demo</strong>
            <br />
            demo@portico.dev · demo1234
          </p>
          <button type="button" onClick={useDemo} className="mt-2 text-[0.75rem] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Isi otomatis
          </button>
        </div>

        <div className="footer-text">
          Belum punya akun?{' '}
          <a href="/register" className="footer-link">Buat akun</a>
        </div>
      </div>
    </main>
  );
}
