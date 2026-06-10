-- Fix dispatch_pending_push_notifications to pass context columns (#4b).
-- Fix create_trip_reminders to set context_trip for per-user translation (#13).
--
-- Background:
--   - Migration 20260608200000 added context_entity/trip/creator columns to
--     notifications and updated the per-row dispatch trigger + create_trip_notification
--     to include them in HTTP payloads. But the polling function
--     (dispatch_pending_push_notifications from 20260527000001) was not updated —
--     it still SELECTs only the original columns and sends no context to the edge
--     function, so trigger-sourced notifications (depth >= 1, dispatched via polling)
--     are delivered without translation context.
--   - create_trip_reminders calls create_trip_notification without context_trip, so
--     trip-reminder push bodies can't be translated per-user in the edge function.

----------------------------------------------------------------------
-- 1. Recreate dispatch_pending_push_notifications with context columns
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.dispatch_pending_push_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge_fn_url  TEXT;
  v_service_key  TEXT;
  v_rec          RECORD;
  v_count        INTEGER := 0;
BEGIN
  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_edge_fn_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_service_role_key'
  LIMIT 1;

  IF v_edge_fn_url IS NULL OR v_service_key IS NULL THEN
    RETURN 0;
  END IF;

  -- Candidates: unsent AND (never queued OR last queued > 5 min ago for retry).
  -- Process oldest first; cap at 200 rows per cron tick.
  FOR v_rec IN
    SELECT id, trip_id, user_id, type, title, body, related_type, related_id,
           context_entity, context_trip, context_creator
    FROM public.notifications
    WHERE push_sent_at IS NULL
      AND (
        push_queued_at IS NULL
        OR push_queued_at < NOW() - INTERVAL '5 minutes'
      )
    ORDER BY created_at ASC
    LIMIT 200
  LOOP
    -- Stamp push_queued_at before HTTP call to prevent duplicate dispatch within
    -- the 5-minute retry window.
    UPDATE public.notifications
    SET push_queued_at = NOW()
    WHERE id = v_rec.id;

    PERFORM net.http_post(
      url     := v_edge_fn_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := jsonb_build_object(
        'notification_id', v_rec.id,
        'trip_id',         v_rec.trip_id,
        'user_id',         v_rec.user_id,
        'type',            v_rec.type,
        'title',           v_rec.title,
        'body',            v_rec.body,
        'related_type',    v_rec.related_type,
        'related_id',      v_rec.related_id,
        'context_entity',  v_rec.context_entity,
        'context_trip',    v_rec.context_trip,
        'context_creator', v_rec.context_creator
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- 2. Recreate create_trip_reminders with context_trip for i18n
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
      v_trip.id,
      NULL,          -- context_entity (not applicable for trip reminders)
      v_trip.title,  -- context_trip: used by edge function for per-user translation
      NULL           -- context_creator
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
