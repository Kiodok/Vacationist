-- Trip reminder cron job.
-- Runs daily at 09:00 UTC and creates reminder notifications for all members of
-- trips that start in exactly 1, 3, or 7 days.
-- Reuses the existing private.create_trip_notification helper and the existing
-- pg_cron push-dispatch pipeline (dispatch-pending-push-notifications).

----------------------------------------------------------------------
-- private.create_trip_reminders()
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_trip_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip  RECORD;
  v_days  INT;
  v_title TEXT;
  v_body  TEXT;
  v_count INT := 0;
  v_today DATE := CURRENT_DATE;
BEGIN
  FOR v_trip IN
    SELECT id, title, start_date
    FROM public.trips
    WHERE deleted_at IS NULL
      AND status = 'planning'
      AND (start_date - v_today) IN (1, 3, 7)
  LOOP
    v_days := v_trip.start_date - v_today;

    -- Skip if we already created a trip-reminder for this trip today.
    -- (Distinguishes trip reminders from organizer nudges via the body pattern.)
    IF EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE trip_id    = v_trip.id
        AND type       = 'reminder'
        AND body LIKE  '%trip starts in%'
        AND created_at::date = v_today
      LIMIT 1
    ) THEN
      CONTINUE;
    END IF;

    IF v_days = 1 THEN
      v_title := 'Trip starts tomorrow: ' || v_trip.title;
      v_body  := 'Your trip starts tomorrow — time to get ready!';
    ELSE
      v_title := v_days || ' days until ' || v_trip.title;
      v_body  := 'Your trip starts in ' || v_days || ' days!';
    END IF;

    -- '00000000-0000-0000-0000-000000000000' → notify ALL members (no exclusion)
    PERFORM private.create_trip_notification(
      v_trip.id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      'reminder',
      v_title,
      v_body,
      'trip',
      v_trip.id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- Schedule: daily at 09:00 UTC
----------------------------------------------------------------------
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'create-trip-reminders';

SELECT cron.schedule(
  'create-trip-reminders',
  '0 9 * * *',
  $$SELECT private.create_trip_reminders()$$
);
