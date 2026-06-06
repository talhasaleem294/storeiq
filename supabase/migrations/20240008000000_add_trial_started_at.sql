-- Add trial_started_at to workspaces for trial countdown banner
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz DEFAULT NOW();

-- Backfill existing trial workspaces: use created_at as the trial start
UPDATE workspaces
  SET trial_started_at = created_at
  WHERE subscription_status = 'trial' AND trial_started_at IS NULL;

GRANT UPDATE (trial_started_at) ON workspaces TO authenticated;
