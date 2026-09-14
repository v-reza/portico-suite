'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hub register. Wired to POST /api/auth/register.
 *
 * Client-side checks mirror the server policy so the user gets immediate
 * feedback, but the server re-validates everything — the client copy is UX, not
 * security.
 */
const POLICY = {
  minLength: 8,
  requiresLetter: true,
  requiresDigit: true,
};

function strength(pw: string): number {
  let n = 0;
  if (pw.length >= POLICY.minLength) n++;
  if (/[a-zA-Z]/.test(pw)) n++;
  if (/[0-9]/.test(pw)) n++;
  return n; // 0..3
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touchedPw, setTouchedPw] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const score = strength(form.password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Gagal membuat akun.');
        return;
      }
      router.push('/pilih-app');
      router.refresh();
    } catch {
      setError('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-[var(--surface-page)] flex items-center justify-center min-h-screen p-4 select-none">
      <div className="w-[380px] bg-[var(--surface-panel)] rounded-lg hairline-border card-shadow p-8 flex flex-col box-border">
        <h1 className="wordmark">Buat akun</h1>

        <form className="flex flex-col gap-4 m-0" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col">
            <label htmlFor="nama" className="form-label">Nama</label>
            <input id="nama" name="nama" type="text" placeholder="Nama lengkap" autoComplete="name" className="form-input" value={form.name} onChange={set('name')} required />
          </div>

          <div className="flex flex-col">
            <label htmlFor="email" className="form-label">Email</label>
            <input id="email" name="email" type="email" placeholder="nama@email.com" autoComplete="email" className="form-input" value={form.email} onChange={set('email')} required />
          </div>

          <div className="flex flex-col">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              className="form-input"
              value={form.password}
              onChange={(e) => { setTouchedPw(true); set('password')(e); }}
              required
            />
            <span className="helper-text">Minimal 8 karakter dengan kombinasi huruf dan angka.</span>
            <div className="flex gap-1 mt-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  data-filled={touchedPw && score > i ? 'true' : 'false'}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    background:
                      touchedPw && score > i
                        ? score >= 3
                          ? 'var(--success)'
                          : 'var(--warning)'
                        : 'var(--surface-sunken)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <label htmlFor="konfirmasi-password" className="form-label">Konfirmasi password</label>
            <input id="konfirmasi-password" name="konfirmasi" type="password" placeholder="••••••••" autoComplete="new-password" className="form-input" value={form.confirm} onChange={set('confirm')} required />
          </div>

          {error && (
            <p role="alert" className="text-[0.75rem] leading-[1.4] text-[var(--critical)] m-0">{error}</p>
          )}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Membuat…' : 'Buat akun'}
          </button>
        </form>

        <div className="divider" />
        <div className="footer-text">
          Sudah punya akun? <a href="/login" className="footer-link">Masuk</a>
        </div>
      </div>
    </main>
  );
}
