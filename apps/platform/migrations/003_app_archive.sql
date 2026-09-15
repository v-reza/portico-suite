-- US-A07 AC2/AC3 — archiving is a soft state, not a delete.
--
-- `is_published` already answers "is the public link live?" (US-A08); archiving
-- is a different axis: the app leaves the main list and its public link stops
-- resolving, but every page, component, workflow and data row stays in the
-- database so a restore brings the same slug back with its data intact.
ALTER TABLE apps ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- The list endpoint filters on it on every request.
CREATE INDEX IF NOT EXISTS apps_archived_idx ON apps(org_id, archived_at);
