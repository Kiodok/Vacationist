-- Phase 15: Multi-Currency Expense Support — Step 2: daily-cached exchange rate table
--
-- Rates are always stored EUR-relative (rate = value of 1 EUR in `currency`); any pair
-- converts via cross-rate: amount_in_Y = amount_in_X * (rate[Y] / rate[X]), with the
-- trivial case rate[EUR] = 1 (also stored explicitly, so callers never special-case EUR).
--
-- History is kept (one row per currency per day) rather than a single mutable "latest"
-- row: volume is tiny (~25 currencies × 365 rows/year) and the drift-detection job in the
-- fetch-exchange-rates Edge Function needs to diff "today's feed" against recent history,
-- not just overwrite state. Populated by a daily pg_cron job — see
-- 20260809100008_create_fetch_exchange_rates_cron.sql — never written to by clients.

CREATE TABLE public.exchange_rates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency     TEXT NOT NULL REFERENCES public.currency_catalog(code),
  rate         NUMERIC(18,8) NOT NULL CHECK (rate > 0),
  as_of        DATE NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (currency, as_of)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_exchange_rates_currency_as_of
  ON public.exchange_rates (currency, as_of DESC);

----------------------------------------------------------------------
-- RLS — same hybrid shape as currency_catalog
----------------------------------------------------------------------

CREATE POLICY "exchange_rates_select_authenticated"
  ON public.exchange_rates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "exchange_rates_no_direct_insert"
  ON public.exchange_rates
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "exchange_rates_no_direct_update"
  ON public.exchange_rates
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "exchange_rates_no_direct_delete"
  ON public.exchange_rates
  FOR DELETE TO anon, authenticated
  USING (false);

----------------------------------------------------------------------
-- Helper: latest rate for a currency (STABLE, used by the expense RPCs below).
-- Returns NULL if no rate has ever been fetched for this currency.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.get_latest_exchange_rate(p_currency TEXT)
RETURNS NUMERIC
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT rate
  FROM public.exchange_rates
  WHERE currency = p_currency
  ORDER BY as_of DESC
  LIMIT 1;
$$;
