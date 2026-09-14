-- Platform schema. One DB per app — see infra/init-db.sql.

CREATE TABLE IF NOT EXISTS organizations (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  plan       text DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id             text PRIMARY KEY,
  email          text UNIQUE NOT NULL,
  password_hash  text NOT NULL,
  name           text NOT NULL,
  org_id         text REFERENCES organizations(id),
  role           text DEFAULT 'viewer' CHECK(role IN ('admin','builder','viewer')),
  hub_sub        text UNIQUE,
  hub_linked_at  timestamptz,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hub_login_states (
  state         text PRIMARY KEY,
  code_verifier text NOT NULL,
  redirect_to   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
  id           text PRIMARY KEY,
  org_id       text REFERENCES organizations(id) NOT NULL,
  name         text NOT NULL,
  slug         text NOT NULL,
  description  text,
  version      int DEFAULT 1,
  is_published boolean DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(org_id, slug)
);

CREATE TABLE IF NOT EXISTS pages (
  id           text PRIMARY KEY,
  app_id       text REFERENCES apps(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  route        text NOT NULL DEFAULT '/',
  order_index  int DEFAULT 0,
  layout_json  jsonb DEFAULT '[]'::jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_data_rows (
  id           text PRIMARY KEY,
  app_id       text REFERENCES apps(id) ON DELETE CASCADE NOT NULL,
  row_json     jsonb NOT NULL,
  created_by   text REFERENCES users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id           text PRIMARY KEY,
  org_id       text REFERENCES organizations(id) NOT NULL,
  user_id      text REFERENCES users(id),
  action       text NOT NULL,
  entity_type  text,
  entity_id    text,
  meta_json    jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apps_org_id_idx ON apps(org_id);
CREATE INDEX IF NOT EXISTS pages_app_id_idx ON pages(app_id, order_index);
CREATE INDEX IF NOT EXISTS data_rows_app_id_idx ON app_data_rows(app_id, created_at DESC);
