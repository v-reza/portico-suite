/**
 * /invite/[token] — public invitation acceptance page (US-A03 AC2/AC3/AC5).
 *
 * This is a public page (no session required). The server reads the invitation
 * and renders appropriate UI for valid/expired/used states.
 */
import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import { InviteAcceptForm } from './InviteAcceptForm';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await one(
    'SELECT id, org_id, email, role, expires_at, accepted_at FROM invitations WHERE token = $1',
    [token],
  );

  if (!invite) notFound();

  const isExpired = !invite.accepted_at && new Date(invite.expires_at) < new Date();
  const isAccepted = !!invite.accepted_at;

  // Get the org name for display
  const org = await one('SELECT name FROM organizations WHERE id = $1', [invite.org_id]);

  return (
    <div className="min-h-screen bg-[var(--surface-page)] flex items-center justify-center p-6">
      <div className="w-full max-w-[560px] bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-xl p-8 shadow-card">
        {isAccepted ? (
          // AC5: already used
          <>
            <h1 className="text-[1.25rem] font-[590] text-[var(--text-primary)] tracking-tight">
              Undangan sudah dipakai
            </h1>
            <p className="text-[0.813rem] text-[var(--text-tertiary)] mt-2">
              Tautan undangan ini sudah pernah digunakan. Jika Anda belum memiliki akun,
              minta pemilik workspace untuk mengirim undangan baru.
            </p>
          </>
        ) : isExpired ? (
          // AC3: expired
          <>
            <h1 className="text-[1.25rem] font-[590] text-[var(--text-primary)] tracking-tight">
              Undangan kedaluwarsa
            </h1>
            <p className="text-[0.813rem] text-[var(--text-tertiary)] mt-2">
              Undangan untuk <strong>{invite.email}</strong> ke{' '}
              <strong>{org?.name ?? 'workspace'}</strong> sudah kedaluwarsa.
              Minta pemilik workspace untuk mengirim ulang undangan.
            </p>
          </>
        ) : (
          // AC2: valid invitation — show accept form
          <InviteAcceptForm
            token={token}
            email={invite.email}
            role={invite.role}
            orgName={org?.name ?? 'workspace'}
          />
        )}
      </div>
    </div>
  );
}