-- Fix dedup guard in private.create_trip_reminders().
-- The previous version matched body LIKE '%trip starts in%', which does not
-- cover the 1-day reminder whose body is "Your trip starts tomorrow…".
-- Use related_type = 'trip' instead — organizer nudges use related_type = NULL,
-- so this correctly distinguishes the two without depending on body text.

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
    -- related_type = 'trip' distinguishes automatic reminders from organizer
    -- nudges, which are inserted with related_type = NULL.
    IF EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE trip_id      = v_trip.id
        AND type         = 'reminder'
        AND related_type = 'trip'
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
