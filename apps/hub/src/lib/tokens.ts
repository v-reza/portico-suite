import { createSign } from 'node:crypto';
import { currentKey } from './keys';

/**
 * Mint an RS256 id_token.
 *
 * Claims are deliberately minimal: sub + email + name + standard time claims.
 * NO role claim — per 00-MASTER-PRD §5.1 the app decides roles from its own
 * local copy, so a leaked token grants identity, never authority.
 */
export interface IdTokenClaims {
  sub: string;
  email: string;
  name: string;
  iss: string;
  aud: string;
  exp: number;
  nbf: number;
  iat: number;
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

export async function mintIdToken(
  claims: Omit<IdTokenClaims, 'iss' | 'exp' | 'nbf' | 'iat'>,
  ttlSeconds = 3600,
): Promise<string> {
  const key = await currentKey();
  const now = Math.floor(Date.now() / 1000);
  const full: IdTokenClaims = {
    ...claims,
    iss: process.env.HUB_ISSUER ?? 'http://localhost:3100',
    iat: now,
    nbf: now - 5,
    exp: now + ttlSeconds,
  };

  const header = { alg: 'RS256', typ: 'JWT', kid: key.kid };
  const signingInput = `${b64(header)}.${b64(full)}`;
  const s = createSign('RSA-SHA256');
  s.update(signingInput);
  s.end();
  return `${signingInput}.${s.sign(key.privatePem).toString('base64url')}`;
}

/** Opaque access token — only ever looked up, never parsed. */
export function mintAccessToken(): string {
  return `ptc_at_${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url')}`;
}
