-- Fix: net.http_post's default timeout (5000ms) is too short for fetch-exchange-rates on a
-- cold start — the function fetches two Frankfurter endpoints plus ExchangeRate-API, reads/
-- writes the full 25-currency catalog for drift detection, and potentially calls Resend.
--
-- Discovered pushing this to prod: the very first (cold) invocation took ~33s. pg_net gave up
-- waiting at 5s and logged a timeout in net._http_response ("Timeout of 5000 ms reached") —
-- but the Edge Function itself was NOT cancelled and completed successfully seconds later
-- (confirmed: exchange_rates populated correctly with a fetched_at timestamp well after the
-- logged timeout). Functionally harmless today, but the daily cron will hit this same cold
-- start every single time (the function only runs once/day, so it never stays warm between
-- invocations) — meaning net._http_response would permanently show a timeout error even on
-- a fully successful run, misleading anyone debugging this later. Bumping the timeout to 45s
-- (comfortably above the observed 33s) makes net._http_response a reliable success/failure
-- signal instead of a false alarm every day.

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
    url                := v_edge_fn_url,
    headers            := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body               := '{}'::jsonb,
    timeout_milliseconds := 45000
  );

  RETURN 1;
END;
$$;
