-- Platform schema extension: pages, components, workflows, data

CREATE TABLE IF NOT EXISTS pages (
  id           text PRIMARY KEY,
  app_id       text NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  name         text NOT NULL,
  route        text NOT NULL DEFAULT '/',
  order_index  int DEFAULT 0,
  layout_json  jsonb DEFAULT '[]'::jsonb,
  created_at   timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pages_app ON pages(app_id, order_index);

CREATE TABLE IF NOT EXISTS components (
  id           text PRIMARY KEY,
  page_id      text NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK(type IN ('text','number','email','textarea','select','checkbox','date','file','button','table','heading','divider','rich_text','rating')),
  config_json  jsonb DEFAULT '{}'::jsonb,
  order_index  int DEFAULT 0,
  parent_id    text REFERENCES components(id),
  created_at   timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comp_page ON components(page_id, order_index);

CREATE TABLE IF NOT EXISTS workflows (
  id            text PRIMARY KEY,
  app_id        text NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  name          text NOT NULL,
  trigger_type  text NOT NULL CHECK(trigger_type IN ('form_submit','cron','webhook','button')),
  config_json   jsonb DEFAULT '{}'::jsonb,
  active        boolean DEFAULT FALSE,
  created_at    timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wf_app ON workflows(app_id);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id            text PRIMARY KEY,
  workflow_id   text NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_order    int NOT NULL,
  action_type   text NOT NULL CHECK(action_type IN ('send_email','call_api','create_row','update_row','delete_row','slack_notify','webhook_out','condition')),
  config_json   jsonb DEFAULT '{}'::jsonb,
  on_error      text DEFAULT 'continue' CHECK(on_error IN ('continue','stop','retry')),
  created_at    timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wfs_wf ON workflow_steps(workflow_id, step_order);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id            text PRIMARY KEY,
  workflow_id   text NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status        text DEFAULT 'pending' CHECK(status IN ('pending','running','success','failed')),
  trigger_by    text,
  input_json    jsonb,
  output_json   jsonb,
  error         text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wfr_wf ON workflow_runs(workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_data_rows (
  id            text PRIMARY KEY,
  app_id        text NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  row_json      jsonb NOT NULL,
  created_by    text REFERENCES users(id),
  created_at    timestamptz DEFAULT NOW(),
  updated_at    timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_adr_app ON app_data_rows(app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS data_sources (
  id               text PRIMARY KEY,
  org_id           text NOT NULL REFERENCES organizations(id),
  name             text NOT NULL,
  type             text CHECK(type IN ('api','postgres','mysql','file')),
  config_encrypted text NOT NULL,
  created_at       timestamptz DEFAULT NOW()
);
