-- Phase 15: Multi-Currency Expense Support — Step 9: daily FX-rate fetch cron
--
-- Follows the proven private.dispatch_pending_push_notifications() template
-- (20260611180000_fix_push_invocation_flood.sql): reads the Edge Function URL + a shared
-- secret from vault.decrypted_secrets, fire-and-forgets a net.http_post(), and no-ops
-- gracefully if the secrets haven't been seeded yet (so this migration is safe to apply
-- before the fetch-exchange-rates Edge Function is deployed/configured).
--
-- pg_cron and pg_net extensions already exist (created in 20260527000001 and
-- 20260522213023 respectively) — not re-declared here.
--
-- Manual step required after this migration (not committed here — secret VALUES never
-- belong in a migration file, matching how push_notification_edge_fn_url /
-- push_notification_service_role_key were seeded, per engineering/supabase.md):
--   SELECT vault.create_secret('<edge-fn-url>', 'fetch_exchange_rates_edge_fn_url');
--   SELECT vault.create_secret('<shared-secret>', 'fetch_exchange_rates_secret');
-- The same shared-secret value must also be set as the FX_RATES_SECRET Edge Function
-- secret (`supabase secrets set FX_RATES_SECRET=...`) on both dev and prod.
--
-- Schedule: 05:30 UTC daily — comfortably after ECB's ~16:00 CET publish time the previous
-- business day. On weekends/holidays Frankfurter simply returns the last published date,
-- which upserts as a no-op re-write of the same (currency, as_of) row — no special handling
-- needed.

CREATE OR REPLACE FUNCTION private.trigger_fetch_exchange_rates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge_fn_url TEXT;
  v_secret      TEXT;
BEGIN
  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'fetch_exchange_rates_edge_fn_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'fetch_exchange_rates_secret'
  LIMIT 1;

  IF v_edge_fn_url IS NULL OR v_secret IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := '{}'::jsonb
  );

  RETURN 1;
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'fetch-exchange-rates-daily';

SELECT cron.schedule(
  'fetch-exchange-rates-daily',
  '30 5 * * *',
  $$SELECT private.trigger_fetch_exchange_rates()$$
);
