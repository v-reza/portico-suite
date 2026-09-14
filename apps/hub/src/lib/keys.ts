import { createCipheriv, createDecipheriv, createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { one, query } from './db';

/**
 * RS256 signing keys for id_token.
 *
 * Private keys are AES-256-GCM encrypted at rest with a key derived from
 * HUB_SESSION_SECRET. The public JWK is stored in the clear because it is served
 * to the world at /.well-known/jwks.json anyway.
 *
 * Rotation (US-M10 AC7): a new key becomes current; the old one is retired, not
 * deleted, so tokens it already signed keep verifying until they expire. Apps
 * discover the new key through their JWKS cache on an unknown `kid`.
 */

export interface SigningKey {
  kid: string;
  privatePem: string;
  publicJwk: Record<string, unknown>;
}

function encKey(): Buffer {
  const s = process.env.HUB_SESSION_SECRET ?? 'dev-only-insecure-secret';
  return createHash('sha256').update(`signing:${s}`).digest();
}

function encrypt(pem: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encKey(), iv);
  const body = Buffer.concat([c.update(pem, 'utf8'), c.final()]);
  return `${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${body.toString('base64')}`;
}

function decrypt(blob: string): string {
  const [ivB, tagB, bodyB] = blob.split('.');
  const d = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivB, 'base64'));
  d.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([d.update(Buffer.from(bodyB, 'base64')), d.final()]).toString('utf8');
}

/** Create a keypair and make it current, retiring whatever was current before. */
export async function rotateKey(): Promise<SigningKey> {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const kid = randomBytes(8).toString('hex');

  // export JWK via a KeyObject so `n`/`e` are base64url as the RFC wants
  const { createPublicKey } = await import('node:crypto');
  const pub = createPublicKey(publicKey).export({ format: 'jwk' }) as Record<string, unknown>;
  const publicJwk = { ...pub, kid, alg: 'RS256', use: 'sig' };

  await query('UPDATE hub_signing_keys SET is_current = false, retired_at = now() WHERE is_current');
  await query(
    `INSERT INTO hub_signing_keys (kid, private_key_enc, public_jwk, is_current)
     VALUES ($1, $2, $3, true)`,
    [kid, encrypt(privateKey), JSON.stringify(publicJwk)],
  );

  return { kid, privatePem: privateKey, publicJwk };
}

/** Current signing key, generating the first one on a fresh database. */
export async function currentKey(): Promise<SigningKey> {
  const row = await one<{ kid: string; private_key_enc: string; public_jwk: Record<string, unknown> }>(
    'SELECT kid, private_key_enc, public_jwk FROM hub_signing_keys WHERE is_current LIMIT 1',
  );
  if (!row) return rotateKey();
  return { kid: row.kid, privatePem: decrypt(row.private_key_enc), publicJwk: row.public_jwk };
}

/**
 * Every key whose tokens may still be valid: the current one plus retired keys
 * inside the token lifetime. Serving retired keys is what makes rotation
 * invisible to apps.
 */
export async function jwks(maxTokenAgeMs = 2 * 60 * 60 * 1000) {
  const rows = await query<{ public_jwk: Record<string, unknown> }>(
    `SELECT public_jwk FROM hub_signing_keys
     WHERE is_current OR retired_at IS NULL OR retired_at > now() - ($1 || ' milliseconds')::interval`,
    [String(maxTokenAgeMs)],
  );
  return { keys: rows.map((r) => r.public_jwk) };
}
