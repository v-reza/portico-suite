import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing with node's built-in scrypt — no bcrypt/argon2 dependency.
 *
 * Format: scrypt$N$r$p$<salt b64>$<hash b64>. The parameters travel with the
 * hash so a future cost bump can rehash on next login instead of invalidating
 * every existing password.
 *
 * ponytail: scrypt over argon2id because it is in node:crypto. Swap when we
 * need memory-hardness beyond 16 MB or GPU-resistance tuning.
 */

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

// 128 * N * r = 16 MB, under node's 32 MB default maxmem.
const N = 16_384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await scryptAsync(plain, salt, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (!salt.length || !expected.length) return false;
    const dk = await scryptAsync(plain, salt, expected.length);
    // Constant-time: a length-dependent early return would leak the hash length.
    return dk.length === expected.length && timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

/** Minimum policy stated on the register screen (STITCH-PROMPTS-HUB PROMPT 2b). */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Password minimal 8 karakter.';
  if (!/[a-zA-Z]/.test(pw)) return 'Password harus memuat huruf.';
  if (!/[0-9]/.test(pw)) return 'Password harus memuat angka.';
  return null;
}
