-- v1.39.0: activity reminders follow each RECIPIENT's timezone, not the trip's.
--
-- Background: the app no longer has a manual timezone picker. Activity times are floating wall-clock
-- digits — "14:00" stays 14:00 wherever the phone is (Germany → Porto). Every member's device keeps
-- `users.timezone` in sync with the phone silently (useDeviceTimezoneSync), so the reminder for a 14:00
-- activity must go out an hour before 14:00 ON THAT MEMBER'S CLOCK. The previous version resolved the
-- activity's start once, in `trips.timezone`, and notified the whole trip at that one instant — right
-- for a group that is all in the trip's zone, an hour off for anyone who travelled from a different one.
--
-- What changes: `private.create_activity_reminders()` now evaluates "starts within the next 65 minutes"
-- per (activity, member) using
--     COALESCE(users.timezone, trips.timezone, 'Europe/Berlin')      -- each checked against pg_timezone_names
-- and inserts one notification row per DUE member (instead of one fan-out call for the whole trip).
--
-- Dedup is per (activity, member) over the same 2-hour window as before, so a member whose zone changes
-- mid-window is never notified twice for one activity.
--
-- Delivery: rows are inserted with push_sent_at NULL and `app.batch_push_pending` set, exactly what
-- create_trip_notification does at trigger depth — the existing polling job dispatches them within ~60 s.
-- (Previously the cron path dispatched immediately; the extra <60 s is immaterial for a 65-minute window.)
--
-- Backwards compatible: no column or signature changes; the cron schedule is untouched; `users.timezone`
-- and `trips.timezone` keep their defaults, so clients that still send/read a timezone are unaffected.
-- An unknown zone name (an old client, a typo) falls through to the next candidate instead of making
-- `timezone()` raise — one bad row must never abort the whole 5-minute run.

CREATE OR REPLACE FUNCTION private.create_activity_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  -- Rows are picked up by the push polling job rather than fired per row.
  PERFORM set_config('app.batch_push_pending', 'true', true);

  WITH valid_tz AS MATERIALIZED (
    SELECT name FROM pg_catalog.pg_timezone_names
  ),
  due AS (
    SELECT
      a.id     AS activity_id,
      a.title  AS activity_title,
      t.id     AS trip_id,
      t.title  AS trip_title,
      tm.user_id
    FROM public.activities a
    JOIN public.trips t         ON t.id = a.trip_id
    JOIN public.trip_members tm ON tm.trip_id = t.id
    JOIN public.users u         ON u.id = tm.user_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        (SELECT name FROM valid_tz WHERE name = u.timezone),
        (SELECT name FROM valid_tz WHERE name = t.timezone),
        'Europe/Berlin'
      ) AS tz
    ) z
    WHERE
      a.activity_date IS NOT NULL
      AND a.start_time IS NOT NULL
      AND a.deleted_at IS NULL
      AND a.status NOT IN ('completed', 'skipped')
      AND t.deleted_at IS NULL
      -- Coarse prefilter on the naive wall-clock value so timezone() is only evaluated for candidates:
      -- an instant in [now, now+65min] corresponds to wall-clock digits within (UTC-12 .. UTC+14) of it.
      AND (a.activity_date + a.start_time)
            BETWEEN (NOW() AT TIME ZONE 'UTC') - INTERVAL '13 hours'
                AND (NOW() AT TIME ZONE 'UTC') + INTERVAL '16 hours'
      -- Starts within the next 65 minutes ON THIS MEMBER'S CLOCK (wider than the 5-minute cadence so
      -- consecutive runs leave no gap).
      AND timezone(z.tz, a.activity_date + a.start_time)
            BETWEEN NOW() AND NOW() + INTERVAL '65 minutes'
      -- Per-member dedup over a time window (not a calendar day — avoids false repeats across midnight).
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.related_type = 'activity_reminder'
          AND n.related_id   = a.id
          AND n.user_id      = tm.user_id
          AND n.created_at   > NOW() - INTERVAL '2 hours'
      )
  )
  INSERT INTO public.notifications (
    trip_id, user_id, type, title, body,
    related_type, related_id,
    context_entity, context_trip, context_creator
  )
  SELECT
    d.trip_id,
    d.user_id,
    'reminder',
    'Activity starting soon',
    NULL,
    'activity_reminder',
    d.activity_id,
    d.activity_title,
    d.trip_title,
    NULL
  FROM due d;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM set_config('app.batch_push_pending', 'false', true);

  RETURN v_count;
END;
$$;
