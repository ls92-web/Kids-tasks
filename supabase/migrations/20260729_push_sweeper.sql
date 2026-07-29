-- ============================================================================
-- Push sweeper: one pg_cron job, every minute, for every family
-- ----------------------------------------------------------------------------
-- The client's fire-and-forget ping delivers instantly in the happy path;
-- this sweeper is the durability net (approved safeguard #6): any delivery a
-- transient failure left queued/failed is retried here with backoff, and
-- events with no ping (e.g. a join request from a not-yet-signed-in child)
-- are picked up within a minute. Auth: the Vault sweeper token, checked
-- inside the send-push function itself. Duplicate cron runs are harmless —
-- deliveries are keyed and status-guarded, and sends mark rows atomically.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('push-sweeper')
 where exists (select 1 from cron.job where jobname = 'push-sweeper');

select cron.schedule(
  'push-sweeper',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://ukqqzzlhirgapoalhjox.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sweeper-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'push_sweeper_token')
    ),
    body := '{}'::jsonb
  )
  $$
);
