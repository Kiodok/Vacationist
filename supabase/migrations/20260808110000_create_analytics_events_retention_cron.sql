-- Phase: 14 — Reddit Pixel & Funnel Dashboard
--
-- Retention job for public.analytics_events. GDPR's storage-limitation principle expects a
-- stated retention limit, not indefinite accumulation — this closes that gap (left open in
-- 20260808100000_create_analytics_events.sql) per Tech Lead decision: 14 months, matching
-- common ad-industry / GA4-style retention. The privacy policy states this same figure.
--
-- Creates:
--   private.prune_analytics_events() — deletes rows older than 14 months, mirroring the
--     private.create_activity_reminders() cron pattern (20260708100000)
--   pg_cron job 'prune-analytics-events' — runs daily at 03:00 UTC (low-traffic window)

----------------------------------------------------------------------
-- 1. private.prune_analytics_events()
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.prune_analytics_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM public.analytics_events
  WHERE created_at < NOW() - INTERVAL '14 months';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- 2. Schedule: daily at 03:00 UTC
----------------------------------------------------------------------

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'prune-analytics-events';

SELECT cron.schedule(
  'prune-analytics-events',
  '0 3 * * *',
  $$SELECT private.prune_analytics_events()$$
);
