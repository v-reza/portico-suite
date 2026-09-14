-- Hub schema. The Hub owns these tables; no app can read them (one database per
-- app — see infra/init-db.sql). Apps only ever see the HTTP surface.

CREATE TABLE IF NOT EXISTS hub_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  display_name   text NOT NULL,
  avatar_url     text,
  is_active      boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Apps allowed to request a token. redirect_uris is an exact-match whitelist —
-- prefix matching is how open-redirect bugs happen.
CREATE TABLE IF NOT EXISTS hub_clients (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  redirect_uris  text[] NOT NULL DEFAULT '{}',
  secret_hash    text NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Per-app role. Vocabulary is deliberately NOT unified (00-MASTER-PRD §5.1).
CREATE TABLE IF NOT EXISTS hub_app_roles (
  user_id     uuid NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  app_id      text NOT NULL REFERENCES hub_clients(id) ON DELETE CASCADE,
  role        text NOT NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  granted_by  uuid REFERENCES hub_users(id),
  PRIMARY KEY (user_id, app_id)
);

-- RS256 keys. Private key is AES-256-GCM encrypted at rest; public JWK is
-- served. Retired keys stay until tokens they signed expire (rotation, US-M10 AC7).
CREATE TABLE IF NOT EXISTS hub_signing_keys (
  kid             text PRIMARY KEY,
  private_key_enc text NOT NULL,
  public_jwk      jsonb NOT NULL,
  is_current      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  retired_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hub_signing_keys_one_current
  ON hub_signing_keys (is_current) WHERE is_current;

CREATE TABLE IF NOT EXISTS hub_sessions (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS hub_sessions_user_idx ON hub_sessions (user_id);

-- Authorization codes: single-use, short TTL, PKCE-bound (US-M10 AC5).
CREATE TABLE IF NOT EXISTS hub_auth_codes (
  code                  text PRIMARY KEY,
  client_id             text NOT NULL REFERENCES hub_clients(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  redirect_uri          text NOT NULL,
  code_challenge        text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  created_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL,
  consumed_at           timestamptz
);

-- Who changed what, when (US-M11 AC3).
CREATE TABLE IF NOT EXISTS hub_audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES hub_users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  subject     text,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_audit_log_created_idx ON hub_audit_log (created_at DESC);

-- Opaque access tokens. Stored hashed: a leaked database dump must not hand the
-- attacker a working bearer token.
CREATE TABLE IF NOT EXISTS hub_access_tokens (
  token_hash  text PRIMARY KEY,
  client_id   text NOT NULL REFERENCES hub_clients(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);
CREATE INDEX IF NOT EXISTS hub_access_tokens_user_idx ON hub_access_tokens (user_id);
