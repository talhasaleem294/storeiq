-- Add campaign status column to ads_data
-- Populated by meta-sync Edge Function via Meta Graph API campaigns endpoint
ALTER TABLE ads_data ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'UNKNOWN';

-- Grant update access for the new column
GRANT UPDATE (status) ON ads_data TO authenticated;
