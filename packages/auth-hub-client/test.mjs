/**
 * Self-check for the Hub client. Run: node test.mjs
 *
 * Asserts the behaviours the PRD makes binding, not just happy paths:
 *   - a valid RS256 token verifies
 *   - alg=none / tampered payload / wrong aud / wrong iss / expired all FAIL
 *   - key rotation works without restarting (unknown kid -> forced refetch)
 *   - provisioning links on email match instead of creating a second account
 *   - probeHub never throws when the Hub is unreachable
 */

import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import {
  createPkcePair, createState, buildAuthorizeUrl,
  verifyIdToken, JwksCache, HubError, planProvisioning, probeHub,
} from './src/index.mjs';

let passed = 0;
const ok = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
};
const okAsync = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
};

const ISSUER = 'http://localhost:3000';
const AUDIENCE = 'platform';

function makeKey(kid) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } };
}

function sign(claims, key, { alg = 'RS256', typ = 'JWT', kid } = {}) {
  const header = { alg, typ, kid: kid ?? key?.kid };
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${enc(header)}.${enc(claims)}`;
  if (alg === 'none') return `${signingInput}.`;
  const s = createSign('RSA-SHA256');
  s.update(signingInput); s.end();
  return `${signingInput}.${s.sign(key.privateKey).toString('base64url')}`;
}

const baseClaims = (over = {}) => ({
  sub: 'hub-user-1', email: 'a@example.com',
  iss: ISSUER, aud: AUDIENCE,
  exp: Math.floor(Date.now() / 1000) + 300,
  nbf: Math.floor(Date.now() / 1000) - 10,
  ...over,
});

const key1 = makeKey('dev-1');
const key2 = makeKey('dev-2');

const jwksFrom = (keys) => ({
  async key(kid) {
    const k = keys.find((x) => x.kid === kid);
    if (!k) throw new HubError('unknown_kid', kid);
    return (await import('node:crypto')).createPublicKey({ key: k.jwk, format: 'jwk' });
  },
});

console.log('PKCE + state');
ok('challenge is S256 of verifier, base64url', () => {
  const { verifier, challenge } = createPkcePair();
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(verifier, challenge);
});
ok('two states differ', () => assert.notEqual(createState(), createState()));
ok('authorize URL carries every required param', () => {
  const url = new URL(buildAuthorizeUrl({
    hubBaseUrl: ISSUER, clientId: 'platform',
    redirectUri: 'http://localhost:3001/api/auth/hub/callback',
    state: 'st', codeChallenge: 'ch',
  }));
  assert.equal(url.pathname, '/authorize');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  for (const p of ['client_id', 'redirect_uri', 'state', 'code_challenge']) {
    assert.ok(url.searchParams.get(p), `${p} missing`);
  }
});

console.log('\nJWT verification');
await okAsync('valid token verifies and returns claims', async () => {
  const t = sign(baseClaims(), key1);
  const c = await verifyIdToken(t, { jwks: jwksFrom([key1]), issuer: ISSUER, audience: AUDIENCE });
  assert.equal(c.sub, 'hub-user-1');
});
await okAsync('alg=none is rejected', async () => {
  const t = sign(baseClaims(), key1, { alg: 'none' });
  await assert.rejects(
    () => verifyIdToken(t, { jwks: jwksFrom([key1]), issuer: ISSUER, audience: AUDIENCE }),
    /bad_alg/,
  );
});
await okAsync('tampered payload is rejected', async () => {
  const t = sign(baseClaims(), key1);
  const [h, , s] = t.split('.');
  const evil = Buffer.from(JSON.stringify(baseClaims({ sub: 'attacker' }))).toString('base64url');
  await assert.rejects(
    () => verifyIdToken(`${h}.${evil}.${s}`, { jwks: jwksFrom([key1]), issuer: ISSUER, audience: AUDIENCE }),
    /bad_signature/,
  );
});
await okAsync('wrong audience is rejected even with a valid signature', async () => {
  const t = sign(baseClaims({ aud: 'helpdesk' }), key1);
  await assert.rejects(
    () => verifyIdToken(t, { jwks: jwksFrom([key1]), issuer: ISSUER, audience: AUDIENCE }),
    /bad_aud/,
  );
});
await okAsync('wrong issuer is rejected', async () => {
  const t = sign(baseClaims({ iss: 'https://evil.example' }), key1);
  await assert.rejects(
    () => verifyIdToken(t, { jwks: jwksFrom([key1]), issuer: ISSUER, audience: AUDIENCE }),
    /bad_iss/,
  );
});
await okAsync('expired token is rejected', async () => {
  const t = sign(baseClaims({ exp: Math.floor(Date.now() / 1000) - 600 }), key1);
  await assert.rejects(
    () => verifyIdToken(t, { jwks: jwksFrom([key1]), issuer: ISSUER, audience: AUDIENCE }),
    /expired/,
  );
});
await okAsync('nbf in the future is rejected', async () => {
  const t = sign(baseClaims({ nbf: Math.floor(Date.now() / 1000) + 600 }), key1);
  await assert.rejects(
    () => verifyIdToken(t, { jwks: jwksFrom([key1]), issuer: ISSUER, audience: AUDIENCE }),
    /not_yet_valid/,
  );
});
await okAsync('token signed by an unknown key is rejected', async () => {
  const t = sign(baseClaims(), key2); // signed by key2, JWKS only serves key1
  await assert.rejects(
    () => verifyIdToken(t, { jwks: jwksFrom([key1]), issuer: ISSUER, audience: AUDIENCE }),
    /unknown_kid/,
  );
});

console.log('\nJWKS rotation without restart');
await okAsync('unknown kid triggers one refetch and then verifies', async () => {
  let served = [key1];
  let fetches = 0;
  const fakeFetch = async () => {
    fetches++;
    return { ok: true, json: async () => ({ keys: served.map((k) => k.jwk) }) };
  };
  const cache = new JwksCache({ jwksUrl: `${ISSUER}/.well-known/jwks.json`, fetchImpl: fakeFetch });

  // warm the cache with key1 only
  await verifyIdToken(sign(baseClaims(), key1), { jwks: cache, issuer: ISSUER, audience: AUDIENCE });
  const afterWarm = fetches;

  // Hub rotates: now serves key2
  served = [key2];
  const t2 = sign(baseClaims(), key2);
  const claims = await verifyIdToken(t2, { jwks: cache, issuer: ISSUER, audience: AUDIENCE });
  assert.equal(claims.sub, 'hub-user-1');
  assert.equal(fetches, afterWarm + 1, 'should refetch exactly once for the new kid');
});

console.log('\nProvisioning decisions');
ok('known sub -> login', () => {
  assert.deepEqual(
    planProvisioning({ sub: 's1' }, { bySub: { id: 7 }, byEmail: null }),
    { action: 'login', userId: 7 },
  );
});
ok('email match -> link, never a second account', () => {
  assert.deepEqual(
    planProvisioning({ sub: 's1', email: 'a@x.com' }, { bySub: null, byEmail: { id: 9 } }),
    { action: 'link', userId: 9, hubSub: 's1' },
  );
});
ok('unknown sub and email -> create', () => {
  assert.deepEqual(
    planProvisioning({ sub: 's1', email: 'a@x.com' }, { bySub: null, byEmail: null }),
    { action: 'create', hubSub: 's1', email: 'a@x.com' },
  );
});
ok('provisioning never carries a role', () => {
  const d = planProvisioning({ sub: 's1', email: 'a@x.com', role: 'admin' }, { bySub: null, byEmail: null });
  assert.equal('role' in d, false);
});

console.log('\nHub availability probe');
await okAsync('unreachable Hub returns reachable:false instead of throwing', async () => {
  const r = await probeHub({
    hubBaseUrl: ISSUER,
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  assert.equal(r.reachable, false);
  assert.equal(r.status, 0);
});
await okAsync('reachable Hub returns reachable:true', async () => {
  const r = await probeHub({ hubBaseUrl: ISSUER, fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.equal(r.reachable, true);
});

console.log(`\n${passed} checks passed`);
