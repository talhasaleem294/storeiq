-- Cost structure config per workspace (COD fee, packaging)
CREATE TABLE workspace_cost_config (
  workspace_id      uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  cod_fee_flat      numeric NOT NULL DEFAULT 0,
  cod_fee_karachi   numeric NOT NULL DEFAULT 0,
  cod_fee_lahore    numeric NOT NULL DEFAULT 0,
  cod_fee_islamabad numeric NOT NULL DEFAULT 0,
  cod_fee_other     numeric NOT NULL DEFAULT 0,
  packaging_cost    numeric NOT NULL DEFAULT 0,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_cost_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can read cost config"
  ON workspace_cost_config FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "owner and admin can manage cost config"
  ON workspace_cost_config FOR ALL
  USING (is_workspace_owner_or_admin(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_cost_config TO authenticated;
