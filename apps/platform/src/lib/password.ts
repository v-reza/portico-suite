import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEYLEN = 64;
const SEPARATOR = '.';

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const dk = (await scryptAsync(pw, salt, KEYLEN)) as Buffer;
  return `${salt}${SEPARATOR}${dk.toString('hex')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(SEPARATOR);
  if (!salt || !hash) return false;
  const dk = (await scryptAsync(pw, salt, KEYLEN)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}

export function passwordProblem(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password minimal 8 karakter.';
  if (pw.length > 200) return 'Password terlalu panjang.';
  return null;
}
