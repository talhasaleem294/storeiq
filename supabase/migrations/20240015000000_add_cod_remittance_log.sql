-- COD remittance log: manual record of courier remittances received
CREATE TABLE cod_remittance_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount       numeric     NOT NULL CHECK (amount > 0),
  received_at  date        NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cod_remittance_log_workspace
  ON cod_remittance_log (workspace_id, received_at DESC);

ALTER TABLE cod_remittance_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON cod_remittance_log TO authenticated;

CREATE POLICY "workspace members can read cod remittance log"
  ON cod_remittance_log FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "owner and admin can manage cod remittance log"
  ON cod_remittance_log FOR ALL
  USING (is_workspace_owner_or_admin(workspace_id));
