/**
 * Hub client for apps A, B and C — the app side of the Authorization Code flow.
 *
 * Contract (00-MASTER-PRD.md §5.1, mirrored in each app spec):
 *   GET /api/auth/hub/start     -> 302 to <hub>/authorize?client_id&redirect_uri&state&code_challenge
 *   GET /api/auth/hub/callback  ?code=&state=
 *
 * Hard rules this module exists to enforce:
 *   1. Local email+password login stays the default and MUST work with the Hub
 *      unreachable. Nothing here is on the local-login path.
 *   2. Roles are NEVER read from the token. The Hub says which apps you may
 *      enter and which app-level role you hold; the app stores its own copy and
 *      enforces it. `sub` is the only identity claim trusted for provisioning.
 *   3. Verification checks iss/aud/exp/nbf, not just the signature.
 *   4. A failure at any step creates no session and no user row.
 *
 * ponytail: no jose/jsonwebtoken dependency — RS256 verify is ~40 lines of
 * node:crypto and this package is the only consumer. Add a library when we need
 * ES256, encryption, or JWE.
 */

import { createPublicKey, createVerify, randomBytes, createHash } from 'node:crypto';

// --- base64url -------------------------------------------------------------

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// --- PKCE ------------------------------------------------------------------

export function createPkcePair() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function createState() {
  return b64url(randomBytes(24));
}

// --- authorization URL -----------------------------------------------------

export function buildAuthorizeUrl({ hubBaseUrl, clientId, redirectUri, state, codeChallenge }) {
  const u = new URL('/authorize', hubBaseUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

// --- token exchange --------------------------------------------------------

export async function exchangeCode({
  hubBaseUrl, clientId, clientSecret, code, redirectUri, codeVerifier, fetchImpl = fetch,
}) {
  const res = await fetchImpl(new URL('/token', hubBaseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    throw new HubError('token_exchange_failed', `${res.status} ${await safeText(res)}`);
  }
  const body = await res.json();
  if (!body.id_token) throw new HubError('token_exchange_failed', 'no id_token in response');
  return body; // { id_token, access_token?, expires_in }
}

async function safeText(res) {
  try { return (await res.text()).slice(0, 200); } catch { return ''; }
}

// --- JWKS cache with rotation ---------------------------------------------

const JWKS_TTL_MS = 10 * 60 * 1000;

export class JwksCache {
  #url;
  #fetch;
  #keys = new Map();
  #fetchedAt = 0;
  #inflight = null;

  constructor({ jwksUrl, fetchImpl = fetch }) {
    this.#url = jwksUrl;
    this.#fetch = fetchImpl;
  }

  async #load(force) {
    if (!force && Date.now() - this.#fetchedAt < JWKS_TTL_MS && this.#keys.size) return;
    if (this.#inflight) return this.#inflight;
    this.#inflight = (async () => {
      const res = await this.#fetch(this.#url);
      if (!res.ok) throw new HubError('jwks_unreachable', `${res.status}`);
      const { keys } = await res.json();
      const next = new Map();
      for (const jwk of keys || []) {
        if (jwk.kty !== 'RSA') continue;
        // kid is required: without it a rotated key cannot be matched.
        if (!jwk.kid) continue;
        next.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
      }
      this.#keys = next;
      this.#fetchedAt = Date.now();
    })().finally(() => { this.#inflight = null; });
    return this.#inflight;
  }

  /**
   * Public key for `kid`. An unknown kid triggers exactly one forced refetch —
   * that is what makes Hub key rotation work without restarting the app.
   */
  async key(kid) {
    await this.#load(false);
    if (this.#keys.has(kid)) return this.#keys.get(kid);
    await this.#load(true); // rotation
    const key = this.#keys.get(kid);
    if (!key) throw new HubError('unknown_kid', `kid ${kid} absent after refresh`);
    return key;
  }
}

// --- JWT verification ------------------------------------------------------

export class HubError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
  }
}

function decodeSegment(seg) {
  try { return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8')); }
  catch { throw new HubError('malformed_token', 'segment is not JSON'); }
}

const CLOCK_SKEW_SECONDS = 60;

/**
 * Verify an RS256 id_token and return its claims.
 *
 * Checks, in order: shape -> alg -> kid -> signature -> iss -> aud -> exp/nbf.
 * Signature before claims so a forged token cannot probe claim validation.
 * Every failure throws; the caller must not create a session or user row.
 */
export async function verifyIdToken(token, { jwks, issuer, audience, now = () => Date.now() }) {
  if (typeof token !== 'string') throw new HubError('malformed_token', 'not a string');
  const parts = token.split('.');
  if (parts.length !== 3) throw new HubError('malformed_token', `${parts.length} segments`);

  const [rawHeader, rawPayload, rawSig] = parts;
  const header = decodeSegment(rawHeader);
  const claims = decodeSegment(rawPayload);

  if (header.alg !== 'RS256') throw new HubError('bad_alg', `alg=${header.alg}`);
  if (!header.kid) throw new HubError('bad_header', 'no kid');
  if (!header.typ || !/JWT/i.test(header.typ)) throw new HubError('bad_header', `typ=${header.typ}`);

  const key = await jwks.key(header.kid);

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${rawHeader}.${rawPayload}`);
  verifier.end();
  if (!verifier.verify(key, Buffer.from(rawSig, 'base64url'))) {
    throw new HubError('bad_signature', 'signature does not verify');
  }

  // Claims are checked only after the signature holds.
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) {
    throw new HubError('bad_aud', `aud=${claims.aud} expected=${audience}`);
  }
  if (claims.iss !== issuer) {
    throw new HubError('bad_iss', `iss=${claims.iss} expected=${issuer}`);
  }
  const nowSec = Math.floor(now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < nowSec) {
    throw new HubError('expired', `exp=${claims.exp}`);
  }
  if (typeof claims.nbf === 'number' && claims.nbf - CLOCK_SKEW_SECONDS > nowSec) {
    throw new HubError('not_yet_valid', `nbf=${claims.nbf}`);
  }
  if (!claims.sub) throw new HubError('no_sub', 'sub is required for provisioning');

  return claims;
}

// --- provisioning decision -------------------------------------------------

/**
 * Decide what to do with a verified `sub`.
 *
 * Returns a decision rather than touching a database, so each app maps it onto
 * its own Prisma client. Note `role` is deliberately absent: roles are the
 * app's business (see §5.1 "Vocabulary peran tidak diseragamkan").
 *
 * @param {{sub: string, email?: string}} claims
 * @param {{bySub?: object|null, byEmail?: object|null}} found
 */
export function planProvisioning(claims, found) {
  if (found.bySub) {
    return { action: 'login', userId: found.bySub.id };
  }
  if (claims.email && found.byEmail) {
    // Hub email matches an existing local user -> LINK, never a second account.
    return { action: 'link', userId: found.byEmail.id, hubSub: claims.sub };
  }
  return { action: 'create', hubSub: claims.sub, email: claims.email ?? null };
}

// --- Hub availability ------------------------------------------------------

/**
 * Probe the Hub for the login-page button state.
 *
 * Never throws and never blocks the local-login path: a Hub that is down must
 * leave email+password working (US-M10 AC3, US-C15 AC6). Callers render a
 * non-blocking notice when `reachable` is false.
 */
export async function probeHub({ hubBaseUrl, fetchImpl = fetch, timeoutMs = 4000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(new URL('/.well-known/jwks.json', hubBaseUrl), {
      signal: ctrl.signal,
    });
    return { reachable: res.ok, status: res.status };
  } catch (err) {
    return { reachable: false, status: 0, reason: err?.name || 'error' };
  } finally {
    clearTimeout(timer);
  }
}
