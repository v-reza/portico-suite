import { NextResponse } from 'next/server';
import { pingDb } from '@/lib/db';

export async function GET() {
  const db = await pingDb();
  return NextResponse.json({
    status: 'ok',
    service: 'portico-platform',
    uptimeSeconds: Math.floor(process.uptime()),
    components: {
      database: { status: db.ok ? 'up' : 'down', latencyMs: db.latencyMs },
    },
  });
}
