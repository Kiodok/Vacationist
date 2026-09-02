-- Addendum item 1b: getLatestExchangeRates() (packages/api/src/currencies.ts) was selecting the
-- entire exchange_rates history table and deduping to "latest per currency" in JS — its own
-- comment claimed otherwise, but the query had no such filter. At 450 rows today (18 as_of
-- dates x ~25 currencies) this is already a wasted download on every app launch that warms the
-- currency cache, and it only grows by ~25 rows/day forever (no retention job exists, nor is one
-- wanted per the Tech Lead — the fix belongs in the query shape, not a prune job).
--
-- New RPC, one row per currency, computed in Postgres via DISTINCT ON instead of the client.
-- SECURITY INVOKER (not the usual SECURITY DEFINER pattern in this repo) is correct here:
-- exchange_rates already grants open SELECT to `authenticated` (20260809100001), so there is no
-- RLS to bypass — running as invoker is strictly safer and needs no search_path bypass beyond
-- disabling implicit schema resolution.

CREATE OR REPLACE FUNCTION public.get_latest_exchange_rates()
RETURNS TABLE (currency TEXT, rate NUMERIC, as_of DATE)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT DISTINCT ON (er.currency) er.currency, er.rate, er.as_of
  FROM public.exchange_rates er
  ORDER BY er.currency, er.as_of DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_latest_exchange_rates() TO authenticated;
