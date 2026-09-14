'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name, org_name: orgName }),
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
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-page)]">
      <div className="w-[380px] bg-[var(--surface-panel)] rounded-lg border border-[var(--border-standard)] p-8">
        <h1 className="text-xl font-semibold mb-1">Daftar di Platform</h1>
        <p className="text-sm text-[var(--text-tertiary)] mb-6">Buat organisasi pertama Anda</p>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-md bg-[var(--critical-tint)] text-[var(--critical)] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="form-label">Nama lengkap</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
          </div>
          <div>
            <label htmlFor="org" className="form-label">Nama organisasi (opsional)</label>
            <input id="org" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="form-input" placeholder="Misal: PT Digital Nusantara" />
          </div>
          <div>
            <label htmlFor="email" className="form-label">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" />
          </div>
          <div>
            <label htmlFor="password" className="form-label">Password</label>
            <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? 'Mendaftar...' : 'Daftar'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a href="/login" className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Sudah punya akun? Masuk
          </a>
        </div>
      </div>
    </div>
  );
}
