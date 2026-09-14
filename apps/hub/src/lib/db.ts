import { Pool } from 'pg';

/**
 * One pool per process. Next dev reloads modules on every edit, so stash the
 * pool on globalThis — otherwise each hot reload leaks a set of connections
 * until Postgres refuses new ones.
 */
const g = globalThis as unknown as { __hubPool?: Pool };

export const pool: Pool =
  g.__hubPool ??
  new Pool({
    connectionString: process.env.HUB_DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (!g.__hubPool) g.__hubPool = pool;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Latency probe for /ready (US-M08 AC2). Never throws. */
export async function pingDb(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, error: (err as Error).name };
  }
}
