import { NextResponse, type NextRequest } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { one, query } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { makeSessionValue, SESSION_COOKIE } from '@/lib/session';

/**
 * GET /api/auth/hub/callback?code=&state=
 *
 * Full flow:
 * 1. Validate state (single-use, PKCE, 10 min TTL) -> consume immediately
 * 2. Exchange code at Hub /token
 * 3. Verify JWT: RS256 via JWKS
 * 4. JIT provisioning: hub_sub -> user
 * 5. Issue local session -> redirect to stored next=
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const state = req.nextUrl.searchParams.get('state') ?? '';

  if (!code || !state) {
    return NextResponse.redirect('/login?error=sso_missing');
  }

  // --- consume state BEFORE we do anything else (single-use) ---
  const stored = await one(
    `DELETE FROM hub_login_states WHERE state = $1 AND expires_at > now()
     RETURNING code_verifier, redirect_to`,
    [state],
  );
  if (!stored) {
    return NextResponse.redirect('/login?error=sso_invalid');
  }

  // --- exchange code at Hub /token ---
  const hubUrl = process.env.AUTH_HUB_URL ?? 'http://localhost:3100';
  const callback = `${process.env.PLATFORM_BASE_URL ?? 'http://localhost:3001'}/api/auth/hub/callback`;
  const tokenRes = await fetch(`${hubUrl}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: callback },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callback,
      code_verifier: stored.code_verifier,
      client_id: process.env.HUB_CLIENT_ID,
      client_secret: process.env.HUB_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect('/login?error=sso_exchange');
  }
  const tokenJson = await tokenRes.json();
  const idToken = tokenJson.id_token;
  if (!idToken) {
    return NextResponse.redirect('/login?error=sso_no_token');
  }

  // --- verify JWT via Hub JWKS (caches + rotates) ---
  const verified = await verifyHubJwt(idToken);
  if (!verified) {
    return NextResponse.redirect('/login?error=sso_verify');
  }

  // --- JIT provisioning: hub_sub UNIQUE, link by email ---
  let user = await one('SELECT * FROM users WHERE hub_sub = $1', [verified.sub]);
  if (!user) {
    // Link by email if exists
    user = await one('SELECT * FROM users WHERE email = $1', [verified.email]);
    if (user) {
      await query('UPDATE users SET hub_sub = $1, hub_linked_at = now() WHERE id = $2', [verified.sub, user.id]);
    } else {
      // Create new in its own org
      const orgId = randomBytes(8).toString('hex');
      await query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)', [orgId, `${verified.name}'s org`, verified.sub.slice(0, 12)]);
      const userId = randomBytes(8).toString('hex');
      await query(
        `INSERT INTO users (id, email, name, org_id, role, hub_sub, hub_linked_at, password_hash)
         VALUES ($1, $2, $3, $4, 'admin', $5, now(), $6)`,
        [userId, verified.email, verified.name, orgId, verified.sub, 'sso-no-password'],
      );
      user = await one('SELECT * FROM users WHERE id = $1', [userId]);
    }
  }

  if (!user) {
    return NextResponse.redirect('/login?error=sso_internal');
  }

  // --- issue local session ---
  const value = makeSessionValue(user.id);
  const url = new URL(callback);
  url.pathname = stored.redirect_to ?? '/apps';
  const res = NextResponse.redirect(url);
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

interface HubClaims {
  sub: string;
  email: string;
  name: string;
  iss: string;
  aud: string;
  exp: number;
  nbf: number;
}

// JWKS cache — stale after 10 minutes, force refresh on unknown kid
let jwksCache: { fetchedAt: number; keys: any[] } | null = null;
const JWKS_TTL = 10 * 60 * 1000;

async function verifyHubJwt(token: string): Promise<HubClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const signature = parts[2];

  const hubUrl = process.env.AUTH_HUB_URL ?? 'http://localhost:3100';
  const now = Date.now();
  if (!jwksCache || now - jwksCache.fetchedAt > JWKS_TTL) {
    const r = await fetch(`${hubUrl}/.well-known/jwks.json`);
    if (!r.ok) return null;
    const jwks = await r.json();
    jwksCache = { fetchedAt: now, keys: jwks.keys ?? [] };
  }

  const key = jwksCache.keys.find((k) => k.kid === header.kid);
  if (!key) {
    // Key rotation — force a retry once
    jwksCache = null;
    return verifyHubJwt(token);
  }

  // Verify RS256 signature using node:crypto
  const { createPublicKey, createVerify } = await import('node:crypto');
  let publicKey;
  try {
    publicKey = createPublicKey({ key: key.pem ?? key, format: key.pem ? 'pem' : 'jwk' });
  } catch {
    return null;
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  if (!verifier.verify(publicKey, signature, 'base64url')) return null;

  // Validate claims
  const expectedIss = `${hubUrl}`;
  const expectedAud = process.env.HUB_CLIENT_ID;
  if (payload.iss !== expectedIss) return null;
  if (payload.aud !== expectedAud) return null;
  if (payload.exp && now > payload.exp * 1000) return null;
  if (payload.nbf && now < payload.nbf * 1000) return null;

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    iss: payload.iss,
    aud: payload.aud,
    exp: payload.exp,
    nbf: payload.nbf,
  };
}
