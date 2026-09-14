import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { one } from '@/lib/db';
import { SESSION_COOKIE, verifySessionCookie } from '@/lib/session';
import { UsersView } from '@/components/UsersView';

/**
 * US-M11 AC6: the admin console must refuse anonymous visitors *server-side*.
 *
 * The page used to be a client component that called window.location on a 401
 * from the API. That returns a full 200 + admin HTML shell to anyone — the guard
 * only exists if JavaScript runs, and a fetch of the raw HTML bypasses it
 * entirely. Auth belongs on the server; the client component only renders.
 *
 * No layout-level check: /login and /register live in the same tree and must
 * stay public, so each protected page guards itself.
 */
export default async function PenggunaPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  const sid = raw ? verifySessionCookie(raw) : null;

  const user = sid
    ? await one<{ id: string }>('SELECT id FROM hub_sessions WHERE id = $1 AND expires_at > now()', [sid])
    : null;
  if (!user) redirect('/login?next=/pengguna');

  return <UsersView />;
}
