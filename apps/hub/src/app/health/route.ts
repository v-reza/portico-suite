import { NextResponse } from 'next/server';

/**
 * GET /health — liveness only, no auth, no dependencies touched (US-M08 AC1).
 *
 * Deliberately does NOT check the database: a liveness probe that fails when a
 * dependency is slow causes restart loops that make the outage worse.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { status: 'ok', service: 'portico-hub', uptimeSeconds: Math.floor(process.uptime()) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
