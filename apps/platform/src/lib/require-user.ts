import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, parseSessionCookie } from './session';
import { one } from './db';

/**
 * Session guard for protected server pages.
 *
 * Two US-A02 requirements meet here:
 *   AC4 — an expired/absent session redirects to /login carrying `?next=` so
 *         the user returns to the page they asked for, not a generic landing.
 *   AC5 — every guarded page is rendered `no-store`. Without it the browser can
 *         serve the page from bfcache/disk after logout and the back button
 *         shows app data to someone with no session.
 *
 * Both the apps list and the app detail page need exactly this, so it lives in
 * one place rather than being copied per page.
 */
export interface SessionUser {
  id: string;
  name: string;
  role: string;
  org_id: string;
}

export async function requireUser(nextPath: string): Promise<SessionUser> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = parseSessionCookie(raw);
  if (!userId) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const u = await one('SELECT id, name, role, org_id FROM users WHERE id = $1', [userId]);
  if (!u) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  return u as SessionUser;
}
