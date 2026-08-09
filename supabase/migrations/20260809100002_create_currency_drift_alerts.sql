-- Phase 15: Multi-Currency Expense Support — Step 3: currency drift audit log
--
-- Append-only record of every currency-availability change the fetch-exchange-rates Edge
-- Function detects (a currency lost from the feed, e.g. a Eurozone accession; a currency
-- newly appearing) and emailed to the Tech Lead about. Never read by the app UI — this is
-- purely an audit trail for "why did is_rate_available flip for X" and to avoid re-alerting
-- on the same change every day. Fully locked to service_role, same shape as
-- public.analytics_events (20260808100000) — no SELECT policy for anon/authenticated at all.

CREATE TABLE public.currency_drift_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL,
  change_type   TEXT NOT NULL CHECK (change_type IN ('lost', 'gained', 'new_unknown')),
  details       TEXT,
  emailed_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.currency_drift_alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_currency_drift_alerts_currency
  ON public.currency_drift_alerts (currency_code, created_at DESC);

CREATE POLICY "currency_drift_alerts_no_direct_insert"
  ON public.currency_drift_alerts
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "currency_drift_alerts_no_direct_update"
  ON public.currency_drift_alerts
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "currency_drift_alerts_no_direct_delete"
  ON public.currency_drift_alerts
  FOR DELETE TO anon, authenticated
  USING (false);
