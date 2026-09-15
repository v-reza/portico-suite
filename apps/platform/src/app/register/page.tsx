'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Register a workspace (US-A01).
 *
 * Visual source: `platform_login` for the Platform shell (380px card, p-6,
 * h-10 controls, 6px radius, the literal label/input/button classes) and
 * `portico_hub_register` for the form anatomy (password helper + strength
 * segments, confirm field, divider, footer). There is no `platform_register`
 * screen in the export, so nothing here is invented — every value comes from
 * one of those two files.
 */

const MIN_PASSWORD = 8;

/** Three segments: length, a letter, a digit — the policy the server enforces. */
function strength(pw: string): number {
  return (pw.length >= MIN_PASSWORD ? 1 : 0) + (/[a-zA-Z]/.test(pw) ? 1 : 0) + (/[0-9]/.test(pw) ? 1 : 0);
}

const inputClass =
  'w-full h-10 px-3 bg-white text-[#101014] placeholder-[#9aa0aa] text-[0.875rem] rounded-[6px] border border-[rgba(15,23,42,0.10)] focus:outline-none focus:border-[#6e5ae6] focus:ring-1 focus:ring-[#6e5ae6] transition-colors';
const labelClass = 'block text-[0.75rem] font-medium text-[#62676f] mb-1.5 leading-normal';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ workspace_name: '', name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const score = strength(form.password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.message ?? 'Gagal mendaftar.');
        return;
      }
      router.push('/apps');
      router.refresh();
    } catch {
      setError('Terjadi kesalahan jaringan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f8] p-4">
      <main className="w-full max-w-[380px] bg-white rounded-lg border border-[rgba(15,23,42,0.10)] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.08)] p-6">
        <div className="mb-6">
          <h1 className="text-[1.25rem] leading-[1.33] font-semibold text-[#101014] tracking-[-0.24px]">Platform</h1>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-md bg-[var(--critical-tint)] text-[var(--critical)] text-[0.75rem] leading-[1.4]">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="workspace_name" className={labelClass}>
              Nama workspace
            </label>
            <input
              id="workspace_name"
              type="text"
              required
              placeholder="Misal: PT Digital Nusantara"
              value={form.workspace_name}
              onChange={set('workspace_name')}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="name" className={labelClass}>
              Nama
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Nama lengkap"
              value={form.name}
              onChange={set('name')}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@email.com"
              value={form.email}
              onChange={set('email')}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              className={inputClass}
            />
            <div className="text-[12px] leading-[1.4] text-[#62676f] mt-1.5">
              Minimal 8 karakter dengan kombinasi huruf dan angka.
            </div>
            <div className="flex gap-1 mt-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-0.5 flex-1 rounded-[1px] transition-colors motion-reduce:transition-none"
                  style={{ background: score > i ? '#6e5ae6' : 'rgba(15,23,42,0.10)' }}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className={labelClass}>
              Konfirmasi password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={set('confirm')}
              className={inputClass}
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={busy}
              className="w-full h-10 px-3.5 bg-[#6e5ae6] hover:bg-[#5b46d6] text-white text-[0.813rem] font-medium rounded-[6px] transition-colors flex items-center justify-center disabled:opacity-60"
            >
              {busy ? 'Membuat…' : 'Buat akun'}
            </button>
          </div>
        </form>

        <div className="h-px bg-[rgba(15,23,42,0.10)] mt-6 mb-4" />
        <div className="text-[12px] leading-[1.5] text-[#62676f] text-center">
          Sudah punya akun?
          <a href="/login" className="text-[#5b46d6] font-medium ml-1 hover:underline">
            Masuk
          </a>
        </div>
      </main>
    </div>
  );
}
