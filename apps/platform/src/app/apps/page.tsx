import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, parseSessionCookie } from '@/lib/session';
import { one } from '@/lib/db';
import { AppsView } from '@/components/AppsView';

export default async function AppsPage() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = parseSessionCookie(raw);
  if (!userId) redirect('/login');

  const u = await one('SELECT id, name, role, org_id FROM users WHERE id = $1', [userId]);
  if (!u) redirect('/login');

  return <AppsView user={{ name: u.name, role: u.role }} />;
}
