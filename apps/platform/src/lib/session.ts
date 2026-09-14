import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'po_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SECRET = process.env.PLATFORM_SESSION_SECRET ?? 'dev-only-insecure-secret';

function sign(id: string): string {
  return createHmac('sha256', SECRET).update(id).digest('base64url');
}

export function makeSessionValue(id: string): string {
  return `${id}.${sign(id)}`;
}

export function parseSessionCookie(value: string | undefined): string | null {
  if (!value) return null;
  // Defense in depth: the value is base64url + '.', reject anything else before
  // we even parse it. A client-supplied cookie must never reach crypto as-is.
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return null;
  const [id, mac] = value.split('.');
  if (!id || !mac) return null;
  const expected = sign(id);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

export { SESSION_COOKIE, SESSION_TTL_MS };
