-- Phase: 14 — Reddit Pixel & Funnel Dashboard
--
-- Creates a first-party funnel event log for the Reddit Ads campaign work. Reddit's own
-- pixel/CAPI reporting only sees what Reddit sees (and only what visitors who accept the
-- ads-consent banner allow), and it cannot show organic traffic on the same axes. This table
-- is the single source of truth for the local funnel dashboard (scripts/analytics-report.mjs)
-- and is written to exclusively by the track-event Edge Function (service_role), never by a
-- client directly.
--
-- Deliberately excludes any raw-IP column — see engineering/software_engineering_guide.md
-- Section 14 for the project's PII-minimization stance. `visitor_hash` is a same-day rotating
-- salted hash computed inside the Edge Function (IP used only as ephemeral hash input, never
-- persisted); the salt lives in the `ANALYTICS_VISITOR_HASH_SALT` Edge Function secret.
--
-- `user_id` uses ON DELETE SET NULL rather than CASCADE or a bare non-cascading FK — this is
-- deliberate so that delete_own_account() (supabase/migrations/20260707110000_...) needs no
-- companion change here. A non-cascading FK with no ON DELETE clause is exactly the gap that
-- broke account deletion for trip_messages (see engineering/supabase.md, 2026-07-27); SET NULL
-- resolves itself on delete and was verified against pg_constraint before writing this.
--
-- Creates:
--   public.analytics_events – append-only funnel event log (no updated_at, no soft delete —
--     rows are immutable facts, not editable records)
--   RLS: fully locked to service_role. No policy grants anon/authenticated any access at all
--     (INSERT/UPDATE/DELETE explicitly denied for both roles for auditability; no SELECT
--     policy exists for either role, so reads are service_role-only by omission).

----------------------------------------------------------------------
-- 1. TABLE
----------------------------------------------------------------------

CREATE TABLE public.analytics_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name     TEXT NOT NULL CHECK (event_name IN (
                    'page_visit',
                    'play_store_click',
                    'web_app_click',
                    'app_store_interest',
                    'sign_up'
                  )),
  surface        TEXT NOT NULL CHECK (surface IN ('marketing', 'web_app', 'native_app')),
  path           TEXT CHECK (path IS NULL OR char_length(path) <= 500),
  rdt_cid        TEXT CHECK (rdt_cid IS NULL OR char_length(rdt_cid) <= 200),
  utm_source     TEXT CHECK (utm_source IS NULL OR char_length(utm_source) <= 200),
  utm_medium     TEXT CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 200),
  utm_campaign   TEXT CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 200),
  utm_content    TEXT CHECK (utm_content IS NULL OR char_length(utm_content) <= 200),
  referrer_host  TEXT CHECK (referrer_host IS NULL OR char_length(referrer_host) <= 255),
  user_agent     TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  visitor_hash   TEXT CHECK (visitor_hash IS NULL OR char_length(visitor_hash) <= 64),
  user_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Dashboard queries: recent-first scan, and per-source funnel breakdown.
CREATE INDEX idx_analytics_events_created_at
  ON public.analytics_events (created_at DESC);

CREATE INDEX idx_analytics_events_utm_source
  ON public.analytics_events (utm_source, created_at DESC)
  WHERE utm_source IS NOT NULL;

----------------------------------------------------------------------
-- 2. RLS — deny-all for client roles, explicit for auditability
----------------------------------------------------------------------

-- No SELECT policy for anon/authenticated at all: reads are service_role-only by omission,
-- matching the intent (only the local dashboard script, using the service-role key, ever
-- reads this table).

CREATE POLICY "analytics_events_no_direct_insert"
  ON public.analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "analytics_events_no_direct_update"
  ON public.analytics_events
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "analytics_events_no_direct_delete"
  ON public.analytics_events
  FOR DELETE TO anon, authenticated
  USING (false);
