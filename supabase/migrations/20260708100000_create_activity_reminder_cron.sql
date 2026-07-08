-- Activity reminder cron job.
-- Runs every 5 minutes and sends a push notification to all trip members for any
-- activity that has both activity_date and start_time set and starts within the next
-- 65 minutes (wider than 60 so consecutive cron runs don't produce gaps).
-- A per-activity dedup check (2-hour time window) ensures each activity produces at most one reminder.
-- Adds a dedicated activity_reminder column to notification_preferences so users can
-- opt out independently of the existing 'reminder' (trip-start / nudge) toggle.

----------------------------------------------------------------------
-- 1. Add activity_reminder preference column
----------------------------------------------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS activity_reminder BOOLEAN NOT NULL DEFAULT TRUE;

----------------------------------------------------------------------
-- 2. private.create_activity_reminders()
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_activity_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rec   RECORD;
  v_count INT := 0;
BEGIN
  FOR v_rec IN
    SELECT
      a.id          AS activity_id,
      a.title       AS activity_title,
      t.id          AS trip_id,
      t.title       AS trip_title
    FROM public.activities a
    JOIN public.trips t ON t.id = a.trip_id
    WHERE
      -- Activity must have a date and a start time
      a.activity_date IS NOT NULL
      AND a.start_time IS NOT NULL
      -- Activity must not be soft-deleted or already finished
      AND a.deleted_at IS NULL
      AND a.status NOT IN ('completed', 'skipped')
      -- Trip must be active
      AND t.deleted_at IS NULL
      -- Activity starts within the next 65 minutes (in trip timezone, converted to UTC)
      AND timezone(t.timezone, a.activity_date + a.start_time)
            BETWEEN NOW() AND NOW() + INTERVAL '65 minutes'
      -- Dedup: no activity_reminder notification created in the past 2 hours for this activity.
      -- Uses a time window (not calendar day) to avoid false double-sends across the UTC midnight boundary.
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.related_type = 'activity_reminder'
          AND n.related_id   = a.id
          AND n.created_at   > NOW() - INTERVAL '2 hours'
      )
  LOOP
    -- '00000000-0000-0000-0000-000000000000' → notify ALL trip members (no exclusion)
    PERFORM private.create_trip_notification(
      v_rec.trip_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      'reminder',
      'Activity starting soon',
      NULL,
      'activity_reminder',
      v_rec.activity_id,
      v_rec.activity_title,
      v_rec.trip_title,
      NULL
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- 3. Schedule: every 5 minutes
----------------------------------------------------------------------
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'create-activity-reminders';

SELECT cron.schedule(
  'create-activity-reminders',
  '*/5 * * * *',
  $$SELECT private.create_activity_reminders()$$
);
