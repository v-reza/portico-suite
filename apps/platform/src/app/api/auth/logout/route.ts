import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

/**
 * POST /api/auth/logout — US-A02 AC5.
 *
 * Clearing the cookie is the easy half. The harder half is that the *previous*
 * page (the app list) must not come back: the browser keeps it in bfcache and
 * the router keeps it in its client cache. So the response is no-store, and the
 * caller (PlatformShell.logout) replaces the history entry rather than pushing
 * a new one — a push would leave the authenticated page one Back press away.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
