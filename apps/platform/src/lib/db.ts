import { Pool } from 'pg';

const g = globalThis as unknown as { __platformPool?: Pool };
export const pool =
  g.__platformPool ??
  new Pool({ connectionString: process.env.PLATFORM_DATABASE_URL });
if (!g.__platformPool) g.__platformPool = pool;

export async function query(text: string, params: any[] = []) {
  return pool.query(text, params);
}
export async function one(text: string, params: any[] = []) {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}

export async function pingDb() {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
