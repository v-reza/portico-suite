import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { jsonError } from '@/lib/auth';

/**
 * GET /api/auth/hub/start — kick off Hub SSO.
 *
 * 1. Generate PKCE verifier + state (single-use, 10 min TTL).
 * 2. Persist in hub_login_states.
 * 3. Redirect to Hub /authorize with our client_id + redirect_uri.
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.AUTH_HUB_URL ?? 'http://localhost:3100';
  const clientId = process.env.HUB_CLIENT_ID;
  const redirectUri = `${process.env.PLATFORM_BASE_URL ?? 'http://localhost:3001'}/api/auth/hub/callback`;

  if (!clientId) return jsonError(500, 'misconfigured', 'SSO Hub tidak dikonfigurasi.');

  const state = randomBytes(16).toString('hex');
  const codeVerifier = randomBytes(32).toString('base64url');
  const redirectTo = req.nextUrl.searchParams.get('next') ?? '/apps';

  await query(
    `INSERT INTO hub_login_states (state, code_verifier, redirect_to, expires_at)
     VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [state, codeVerifier, redirectTo],
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeVerifier, // plain method for simplicity; S256 in prod
    code_challenge_method: 'plain',
    response_type: 'code',
  });

  return NextResponse.redirect(`${baseUrl}/authorize?${params}`);
}
