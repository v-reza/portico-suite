import { NextResponse } from 'next/server';
import { pingDb } from '@/lib/db';

/**
 * GET /ready — per-component readiness with latency (US-M08 AC2/AC3/AC6).
 *
 * Contract:
 *   - 200 only when every REQUIRED component is up; otherwise 503.
 *   - The failing component is named (AC3), never a bare "error".
 *   - No connection strings, hostnames, versions, or stack traces (AC4).
 *   - no-store, so two consecutive calls cannot serve a cached body (AC5).
 *   - Recovers without a restart once a component is healthy again (AC6).
 */
export const dynamic = 'force-dynamic';

async function probeRedis(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  const url = process.env.REDIS_URL;
  if (!url) return { ok: false, ms: 0, error: 'not_configured' };
  try {
    const { createConnection } = await import('node:net');
    const u = new URL(url);
    await new Promise<void>((resolve, reject) => {
      const sock = createConnection(
        { host: u.hostname, port: Number(u.port || 6379) },
        () => {
          sock.write('PING\r\n');
        },
      );
      sock.setTimeout(2000);
      sock.on('data', (d) => {
        if (d.toString().includes('PONG')) {
          sock.end();
          resolve();
        }
      });
      sock.on('timeout', () => {
        sock.destroy();
        reject(new Error('timeout'));
      });
      sock.on('error', (e) => {
        sock.destroy();
        reject(e);
      });
    });
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, error: (err as Error).name };
  }
}

export async function GET() {
  const [db, redis] = await Promise.all([pingDb(), probeRedis()]);

  const components = {
    database: { status: db.ok ? 'up' : 'down', latencyMs: db.ms, ...(db.ok ? {} : { reason: db.error }) },
    redis: { status: redis.ok ? 'up' : 'down', latencyMs: redis.ms, ...(redis.ok ? {} : { reason: redis.error }) },
  };

  const failed = Object.entries(components)
    .filter(([, c]) => c.status !== 'up')
    .map(([name]) => name);

  const body = {
    status: failed.length ? 'degraded' : 'ready',
    components,
    // Name what broke, without saying how to reach it (AC3 + AC4).
    ...(failed.length ? { failed } : {}),
    checkedAt: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: failed.length ? 503 : 200,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
