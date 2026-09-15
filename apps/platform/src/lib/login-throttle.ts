import { redis } from './redis';

/**
 * Login throttle — US-A02 AC3.
 *
 * "Kalau 5 kegagalan dalam 10 menit untuk satu email, maka login diblokir 15
 * menit untuk email itu."
 *
 * Counter lives in Redis, not in process memory: a per-process Map would reset
 * on every dev-server reload and would not be shared, which is exactly the
 * failure mode US-A32 AC4 calls out for the other limiter. Redis is already a
 * suite dependency (apps/hub probes it in /ready).
 *
 * Fail-open: if Redis is unreachable the login still works. Locking every user
 * out of the product because the shared store blipped is worse than briefly
 * having no throttle, and the master PRD's independence rule points the same
 * way. The failure is logged so it is visible, not silent.
 */
const MAX_FAILURES = 5;
const WINDOW_SECONDS = 10 * 60;
const BLOCK_SECONDS = 15 * 60;

/** Key by email, lowercased and trimmed so casing cannot split the counter. */
function failKey(email: string): string {
  return `platform:login:fail:${email.trim().toLowerCase()}`;
}

function blockKey(email: string): string {
  return `platform:login:block:${email.trim().toLowerCase()}`;
}

export interface ThrottleState {
  blocked: boolean;
  /** Whole seconds until the block lifts — the value a Retry-After carries. */
  retryAfter: number;
}

/** How long the email is still blocked, if at all. */
export async function checkLoginBlock(email: string): Promise<ThrottleState> {
  try {
    const ttl = await redis('TTL', blockKey(email));
    const seconds = typeof ttl === 'number' ? ttl : -2;
    // -2 = key absent, -1 = present without expiry. Only a positive TTL blocks.
    return { blocked: seconds > 0, retryAfter: seconds > 0 ? seconds : 0 };
  } catch (err) {
    console.warn('[login-throttle] check failed, failing open:', (err as Error).message);
    return { blocked: false, retryAfter: 0 };
  }
}

/**
 * Record one failed attempt.
 *
 * The attempt that trips the limit is still a real authentication failure, so
 * it answers 401 like the four before it; the *next* request is the one the
 * pre-check refuses with 429. Refusing the fifth attempt with a 429 would hide
 * a genuine wrong-password result behind a throttle message.
 */
export async function recordLoginFailure(email: string): Promise<void> {
  try {
    const key = failKey(email);
    const count = await redis('INCR', key);
    // The window only starts on the first failure; INCR would otherwise leave
    // the key immortal and the 10-minute window would never close (a temporary
    // block must stay temporary).
    if (count === 1) await redis('EXPIRE', key, WINDOW_SECONDS);

    if (typeof count === 'number' && count >= MAX_FAILURES) {
      await redis('SET', blockKey(email), '1', 'EX', BLOCK_SECONDS);
      await redis('DEL', key);
    }
  } catch (err) {
    console.warn('[login-throttle] record failed, failing open:', (err as Error).message);
  }
}

/** A successful login clears the slate — AC3 blocks failures, not the account. */
export async function clearLoginFailures(email: string): Promise<void> {
  try {
    await redis('DEL', failKey(email), blockKey(email));
  } catch (err) {
    console.warn('[login-throttle] clear failed:', (err as Error).message);
  }
}

export { MAX_FAILURES, WINDOW_SECONDS, BLOCK_SECONDS };
