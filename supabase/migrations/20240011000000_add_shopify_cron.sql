-- Enable extensions needed for HTTP calls from pg_cron
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Grant pg_cron usage to postgres role
grant usage on schema cron to postgres;

-- Table to hold cron secrets (private schema, postgres-only access)
-- Avoids the need for superuser ALTER DATABASE SET which Supabase blocks.
create schema if not exists private;

create table if not exists private.cron_config (
  key   text primary key,
  value text not null
);

-- Only the postgres role (used by pg_cron) can read this table
revoke all on private.cron_config from public, anon, authenticated;
grant select on private.cron_config to postgres;

-- Daily Shopify sync: 2am PKT = 9pm UTC
-- After pushing this migration, run once in the SQL editor:
--   INSERT INTO private.cron_config (key, value)
--   VALUES ('cron_secret', '<same value you used in: supabase secrets set CRON_SECRET=...>');
select cron.schedule(
  'shopify-sync-all-daily',
  '0 21 * * *',
  $$
  select net.http_post(
    url     := 'https://wotnhebzmrrkeplgohiq.supabase.co/functions/v1/shopify-sync-all',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', (select value from private.cron_config where key = 'cron_secret')
               ),
    body    := '{}'::jsonb
  ) as request_id;
  $$
);
