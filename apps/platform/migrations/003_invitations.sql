-- Invitation + member management for US-A03
CREATE TABLE IF NOT EXISTS invitations (
  id           text PRIMARY KEY,
  org_id       text NOT NULL REFERENCES organizations(id),
  email        text NOT NULL,
  role         text NOT NULL CHECK(role IN ('admin','builder','viewer')),
  token        text UNIQUE NOT NULL,
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  created_by   text REFERENCES users(id),
  created_at   timestamptz DEFAULT NOW(),
  UNIQUE(org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_invites_org ON invitations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invitations(token);

-- Add role change tracking column to activity_logs
-- (activity_logs already has action, entity_type, entity_id, meta_json)