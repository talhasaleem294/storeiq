-- Alert cooldown log — prevents repeated notifications for the same threshold breach
-- Used by future alert Edge Functions (WhatsApp, email) via canAlert()/recordAlert() helpers

CREATE TABLE IF NOT EXISTS alert_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  alert_type    text        NOT NULL,  -- e.g. 'roas_drop', 'profit_drop', 'rto_spike'
  entity_id     text        NOT NULL DEFAULT '',  -- campaign_id, city, etc. ('' for workspace-level)
  triggered_at  timestamptz NOT NULL DEFAULT now(),
  cooldown_hours int        NOT NULL DEFAULT 168  -- 7 days
);

CREATE INDEX IF NOT EXISTS alert_log_workspace
  ON alert_log (workspace_id, alert_type, entity_id, triggered_at DESC);

ALTER TABLE alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can read alert_log"
  ON alert_log FOR SELECT
  USING (is_workspace_member(workspace_id));

GRANT SELECT, INSERT ON alert_log TO authenticated;
