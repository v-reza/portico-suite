import { NextResponse } from 'next/server';
import { pingDb } from '@/lib/db';

export async function GET() {
  const db = await pingDb();
  const allUp = db.ok;
  return NextResponse.json(
    {
      status: allUp ? 'ready' : 'degraded',
      components: { database: { status: db.ok ? 'up' : 'down', latencyMs: db.latencyMs } },
      checkedAt: new Date().toISOString(),
    },
    { status: allUp ? 200 : 503, headers: { 'cache-control': 'no-store, no-cache, must-revalidate' } },
  );
}
