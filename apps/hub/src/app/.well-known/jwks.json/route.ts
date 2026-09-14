import { NextResponse } from 'next/server';
import { jwks } from '@/lib/keys';

/**
 * GET /.well-known/jwks.json — public key set (US-M10 AC7).
 *
 * Serving retired keys alongside the current one is what makes rotation
 * invisible: a token signed by the previous key still verifies until it expires.
 * Short max-age so a rotation propagates quickly, but not zero — the app-side
 * cache already handles an unknown kid by refetching.
 */
export async function GET() {
  try {
    const set = await jwks();
    return NextResponse.json(set, {
      headers: { 'Cache-Control': 'public, max-age=600' },
    });
  } catch (err) {
    // Never leak the DB error text — a JWKS failure is an ops signal, not a
    // client diagnostic (US-M08 AC4).
    console.error('[jwks]', (err as Error).message);
    return NextResponse.json({ keys: [] }, { status: 503 });
  }
}
