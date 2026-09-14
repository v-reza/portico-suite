import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { one, query } from '@/lib/db';
import { mintAccessToken, mintIdToken } from '@/lib/tokens';
import { audit } from '@/lib/audit';

/**
 * POST /token — exchange an authorization code for tokens.
 *
 * Everything that can fail is checked BEFORE any token is minted, and the code
 * is consumed atomically, so a replay or a failed verification leaves no
 * half-provisioned state behind (US-M10 AC5).
 *
 * Client auth: client_secret is compared against a SHA-256 hash. The secret is
 * only ever sent server-to-server by the app, never through a browser.
 */
export async function POST(req: NextRequest) {
  let form: URLSearchParams;
  try {
    const raw = await req.text();
    form = new URLSearchParams(raw);
  } catch {
    return oauthError('invalid_request', 'Body harus application/x-www-form-urlencoded.');
  }

  if (form.get('grant_type') !== 'authorization_code') {
    return oauthError('unsupported_grant_type', 'Hanya grant_type=authorization_code.');
  }

  const code = form.get('code') ?? '';
  const redirectUri = form.get('redirect_uri') ?? '';
  const clientId = form.get('client_id') ?? '';
  const clientSecret = form.get('client_secret') ?? '';
  const verifier = form.get('code_verifier') ?? '';

  if (!code || !redirectUri || !clientId || !clientSecret || !verifier) {
    return oauthError('invalid_request', 'code, redirect_uri, client_id, client_secret, dan code_verifier wajib ada.');
  }

  const client = await one<{ id: string; secret_hash: string; is_active: boolean }>(
    'SELECT id, secret_hash, is_active FROM hub_clients WHERE id = $1',
    [clientId],
  );
  const secretOk =
    !!client &&
    createHash('sha256').update(clientSecret).digest('hex') === client.secret_hash;
  if (!client || !client.is_active || !secretOk) {
    return oauthError('invalid_client', 'client_id atau client_secret salah.');
  }

  const row = await one<{
    code: string; user_id: string; redirect_uri: string; code_challenge: string;
    code_challenge_method: string; consumed_at: string | null; expired: boolean;
    email: string; display_name: string;
  }>(
    `SELECT c.code, c.user_id, c.redirect_uri, c.code_challenge, c.code_challenge_method,
            c.consumed_at, (c.expires_at <= now()) AS expired,
            u.email, u.display_name
       FROM hub_auth_codes c
       JOIN hub_users u ON u.id = c.user_id
      WHERE c.code = $1 AND c.client_id = $2`,
    [code, clientId],
  );

  if (!row) return oauthError('invalid_grant', 'Code tidak dikenal.');
  if (row.consumed_at) return oauthError('invalid_grant', 'Code sudah dipakai.');
  if (row.expired) return oauthError('invalid_grant', 'Code sudah kedaluwarsa.');
  if (row.redirect_uri !== redirectUri) {
    return oauthError('invalid_grant', 'redirect_uri tidak sama dengan saat authorize.');
  }

  const challenge = createHash('sha256').update(verifier).digest('base64url');
  if (challenge !== row.code_challenge) {
    return oauthError('invalid_grant', 'code_verifier tidak cocok dengan code_challenge.');
  }

  // Consume first: a concurrent second exchange must lose the race.
  const consumed = await query(
    'UPDATE hub_auth_codes SET consumed_at = now() WHERE code = $1 AND consumed_at IS NULL RETURNING code',
    [code],
  );
  if (consumed.length === 0) return oauthError('invalid_grant', 'Code sudah dipakai.');

  const idToken = await mintIdToken({
    sub: row.user_id,
    email: row.email,
    name: row.display_name,
    aud: clientId,
  });

  const accessToken = mintAccessToken();
  await query(
    `INSERT INTO hub_access_tokens (token_hash, client_id, user_id, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 hour')`,
    [createHash('sha256').update(accessToken).digest('hex'), clientId, row.user_id],
  );

  await audit(row.user_id, 'token.issued', row.email, { client_id: clientId });

  return NextResponse.json(
    { access_token: accessToken, id_token: idToken, token_type: 'Bearer', expires_in: 3600 },
    { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
  );
}

function oauthError(error: string, description: string) {
  return NextResponse.json({ error, error_description: description }, { status: 400 });
}
