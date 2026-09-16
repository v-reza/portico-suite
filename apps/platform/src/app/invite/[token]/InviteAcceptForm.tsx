'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function InviteAcceptForm({
  token, email, role, orgName,
}: {
  token: string; email: string; role: string; orgName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roleLabel = role === 'admin' ? 'Admin'
    : role === 'builder' ? 'Builder'
    : 'Viewer';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, confirm }),
      });
      if (res.ok) {
        // Accepted — redirect to apps page (session already set)
        router.push('/apps');
      } else {
        const data = await res.json();
        setError(data.message || 'Gagal menerima undangan.');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-[1.25rem] font-[590] text-[var(--text-primary)] tracking-tight">
        Terima undangan
      </h1>
      <p className="text-[0.813rem] text-[var(--text-tertiary)] mt-2 mb-6">
        Anda diundang sebagai{' '}
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--surface-accent-tint)] text-[var(--accent-hover)] font-mono text-[0.75rem] ml-2.5">
          {roleLabel}
        </span>{' '}
        di <strong>{orgName}</strong>
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="px-3 py-2 rounded-md bg-red-50 text-red-600 text-[0.75rem]">{error}</div>
        )}

        <div>
          <label className="block text-[0.75rem] font-medium text-[var(--text-secondary)] mb-1">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full h-9 px-3 rounded-md border border-[var(--border-standard)] bg-[var(--surface-sunken)] text-[13px] text-[var(--text-tertiary)] cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-[0.75rem] font-medium text-[var(--text-secondary)] mb-1">Nama</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama lengkap"
            required
            className="w-full h-9 px-3 rounded-md border border-[var(--border-standard)] bg-[var(--surface-panel)] text-[13px] text-[var(--text-primary)] placeholder-[#9aa0aa] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-[0.75rem] font-medium text-[var(--text-secondary)] mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 karakter"
            required
            minLength={8}
            className="w-full h-9 px-3 rounded-md border border-[var(--border-standard)] bg-[var(--surface-panel)] text-[13px] text-[var(--text-primary)] placeholder-[#9aa0aa] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-[0.75rem] font-medium text-[var(--text-secondary)] mb-1">Konfirmasi Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Ulangi password"
            required
            minLength={8}
            className="w-full h-9 px-3 rounded-md border border-[var(--border-standard)] bg-[var(--surface-panel)] text-[13px] text-[var(--text-primary)] placeholder-[#9aa0aa] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !name || !password || !confirm}
          className="mt-2 h-10 w-full rounded-md bg-[var(--accent)] text-white text-[0.875rem] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Memproses...' : 'Terima undangan & masuk'}
        </button>
      </form>
    </>
  );
}