-- Store live USD/PKR rate in cost config so Edge Functions use accurate rate
-- Updated weekly by the update-exchange-rate Edge Function via pg_cron

ALTER TABLE workspace_cost_config
  ADD COLUMN IF NOT EXISTS usd_to_pkr_rate numeric DEFAULT 278;

-- Schedule weekly update (every Sunday 6pm UTC = 11pm PKT)
-- Requires pg_cron + pg_net extensions (already enabled via migration 20240011)
SELECT cron.schedule(
  'update-exchange-rate-weekly',
  '0 18 * * 0',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/update-exchange-rate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', current_setting('app.cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
