import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { one } from '@/lib/db';
import { SESSION_COOKIE, verifySessionCookie } from '@/lib/session';
import { RolesView } from '@/components/RolesView';

/**
 * US-M11 AC6: the admin console must refuse anonymous visitors *server-side*.
 * See pengguna/page.tsx for why the check lives here and not in the client.
 */
export default async function PeranPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  const sid = raw ? verifySessionCookie(raw) : null;

  const user = sid
    ? await one<{ id: string }>('SELECT id FROM hub_sessions WHERE id = $1 AND expires_at > now()', [sid])
    : null;
  if (!user) redirect('/login?next=/peran');

  return <RolesView />;
}
