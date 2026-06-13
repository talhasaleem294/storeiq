-- Add monthly_overheads to workspace_cost_config
-- Allows store owners to deduct fixed monthly costs (salaries, rent, etc.) from net profit

ALTER TABLE workspace_cost_config
  ADD COLUMN IF NOT EXISTS monthly_overheads numeric DEFAULT 0;
