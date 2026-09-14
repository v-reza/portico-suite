import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Hub session cookie: `<sessionId>.<hmac>`, httpOnly + SameSite=Lax.
 *
 * The cookie carries only an opaque id — the row in hub_sessions is the source
 * of truth, so logout and expiry are server-enforced rather than trusting a
 * self-describing token.
 */

export const SESSION_COOKIE = 'hub_session';
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1h, matches id_token expiry

function secret(): string {
  const s = process.env.HUB_SESSION_SECRET;
  if (!s || s.startsWith('ganti-')) {
    // Dev fallback only. Never silently accept this in production.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('HUB_SESSION_SECRET must be set in production');
    }
    return 'dev-only-insecure-secret';
  }
  return s;
}

export function newSessionId(): string {
  return randomBytes(24).toString('base64url');
}

export function signSessionId(id: string): string {
  const mac = createHmac('sha256', secret()).update(id).digest('base64url');
  return `${id}.${mac}`;
}

export function verifySessionCookie(value: string | undefined | null): string | null {
  if (!value) return null;
  const i = value.lastIndexOf('.');
  if (i <= 0) return null;
  const id = value.slice(0, i);
  const mac = Buffer.from(value.slice(i + 1));
  const expected = Buffer.from(createHmac('sha256', secret()).update(id).digest('base64url'));
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(mac, expected)) return null;
  return id;
}

export function sessionCookieOptions(maxAgeMs = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}
