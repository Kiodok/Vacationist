-- Phase 15: Multi-Currency Expense Support — Step 1: currency reference table
--
-- Replaces the hardcoded CURRENCY = ['EUR','CHF','USD'] enum (packages/types/src/enums.ts)
-- and its two duplicated CHECK constraints (trips_base_currency_check, expenses_currency_check)
-- with a single DB-backed reference table. The whole point of this table is that the supported
-- currency list can change (a currency added/removed from the daily FX feed, e.g. a country
-- adopting the euro) without an app deploy or a schema migration — see
-- 20260809100008_create_fetch_exchange_rates_cron.sql for the daily job that keeps
-- is_rate_available / missing_since current.
--
-- RLS pattern: readable by any authenticated user (like public.users), writable only by
-- service_role (the fetch-exchange-rates Edge Function's client) — same hybrid shape used
-- for public.analytics_events (20260808100000).

CREATE TABLE public.currency_catalog (
  code               TEXT PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  name               TEXT NOT NULL,
  symbol             TEXT,
  is_rate_available  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  missing_since      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.currency_catalog ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER currency_catalog_updated_at
  BEFORE UPDATE ON public.currency_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

----------------------------------------------------------------------
-- RLS
----------------------------------------------------------------------

CREATE POLICY "currency_catalog_select_authenticated"
  ON public.currency_catalog
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "currency_catalog_no_direct_insert"
  ON public.currency_catalog
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "currency_catalog_no_direct_update"
  ON public.currency_catalog
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "currency_catalog_no_direct_delete"
  ON public.currency_catalog
  FOR DELETE TO anon, authenticated
  USING (false);

----------------------------------------------------------------------
-- Seed: curated European currency set + USD (already in use).
-- is_rate_available reflects verified live coverage from api.frankfurter.dev/v1/currencies
-- (ECB reference rates) as of 2026-08-09. Currencies the free feed doesn't price are still
-- selectable (is_active = true) — trips/expenses can be denominated in them — but auto-
-- conversion and "Show in X" are disabled for them until a rate actually appears.
----------------------------------------------------------------------

INSERT INTO public.currency_catalog (code, name, symbol, is_rate_available) VALUES
  ('EUR', 'Euro',                     '€',   TRUE),
  ('USD', 'US Dollar',                '$',   TRUE),
  ('GBP', 'British Pound',            '£',   TRUE),
  ('CHF', 'Swiss Franc',              'CHF', TRUE),
  ('NOK', 'Norwegian Krone',          'kr',  TRUE),
  ('SEK', 'Swedish Krona',            'kr',  TRUE),
  ('DKK', 'Danish Krone',             'kr',  TRUE),
  ('ISK', 'Icelandic Króna',          'kr',  TRUE),
  ('PLN', 'Polish Złoty',             'zł',  TRUE),
  ('CZK', 'Czech Koruna',             'Kč',  TRUE),
  ('HUF', 'Hungarian Forint',         'Ft',  TRUE),
  ('RON', 'Romanian Leu',             'lei', TRUE),
  ('TRY', 'Turkish Lira',             '₺',   TRUE),
  ('BGN', 'Bulgarian Lev',            'лв',  FALSE),
  ('RSD', 'Serbian Dinar',            'дин', FALSE),
  ('BAM', 'Bosnia-Herzegovina Mark',  'KM',  FALSE),
  ('MKD', 'Macedonian Denar',         'ден', FALSE),
  ('ALL', 'Albanian Lek',             'L',   FALSE),
  ('UAH', 'Ukrainian Hryvnia',        '₴',   FALSE),
  ('MDL', 'Moldovan Leu',             'L',   FALSE),
  ('BYN', 'Belarusian Ruble',         'Br',  FALSE),
  ('GEL', 'Georgian Lari',            '₾',   FALSE),
  ('AMD', 'Armenian Dram',            '֏',   FALSE),
  ('AZN', 'Azerbaijani Manat',        '₼',   FALSE),
  ('GIP', 'Gibraltar Pound',          '£',   FALSE);
