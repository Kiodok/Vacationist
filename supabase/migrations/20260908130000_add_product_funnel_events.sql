-- Growth Plan Q4 2026, Phase 0: first-party product-funnel analytics. Adds four
-- event names to analytics_events so the web app (web.vacationist.app only — see
-- the trackFeatureEvent helper and the "no tracking in the native app" posture in
-- docs/privacy-policy.html) can log the activation loop the marketing funnel can't
-- see: a trip created, an invite link generated, an invite accepted, an expense
-- added.
--
-- Same DROP + re-ADD pattern as 20260817110000_add_app_store_click_event.sql.
-- Additive + permissive: every value already in the table stays allowed, so the
-- ADD CONSTRAINT validates existing rows instantly. The allowlist is mirrored by
-- hand in supabase/functions/track-event/index.ts (EVENT_NAMES) and
-- packages/types/src/analytics.ts (ANALYTICS_EVENT_NAME) — all three must move
-- together.

ALTER TABLE public.analytics_events
  DROP CONSTRAINT analytics_events_event_name_check;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_event_name_check
  CHECK (event_name IN (
    'page_visit',
    'play_store_click',
    'app_store_click',
    'web_app_click',
    'app_store_interest',
    'sign_up',
    'trip_created',
    'invite_sent',
    'invite_accepted',
    'expense_added'
  ));
