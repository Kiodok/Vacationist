-- v1.39.1: three scheduled-notification defects found while auditing the "after trip" crons for the
-- false unsettled-expenses reminder (see 20260924100000). Function bodies only — no schema change,
-- no signature change, cron schedules untouched.
--
-- 1. The auto-seeded demo trip ("Barcelona Weekend", is_example = true, start_date = today + 3 months,
--    status 'planning') was treated as a real trip by create_trip_reminders and
--    create_guest_nudge_notifications, so every new user got "in 7 days / in 3 days / tomorrow" pushes
--    about a fake trip ~3 months after sign-up. create_review_nudge_notifications got this fix on
--    2026-09-17 (20260917100000); these two — and the planning nudge — were missed.
--
-- 2. create_planning_nudge_notifications only deduped over a rolling 14 days, so it re-fired every 14
--    days FOREVER for any user whose latest trip was old, with no opt-out. Now capped at 3 nudges per
--    user, ever (Tech Lead decision). Also: the demo trip neither counts as "the user's latest trip"
--    nor as an "upcoming trip" that suppresses the nudge.
--
-- 3. Only the push Edge Function honoured notification_preferences.reminder, so muting "reminder" for a
--    trip still wrote the in-app row and badge. All four reminder/nudge crons now skip members who
--    switched it off (a missing preferences row means opted in). Deliberately NOT moved into
--    private.create_trip_notification — that helper also serves new_activity / vote_update /
--    expense_change, and changing them is a separate product call.
--
-- create_trip_reminders already dedups on related_type = 'trip' (20260602130000), so nothing to change
-- there. It stops calling private.create_trip_notification (which fans out to every member with no
-- per-member filter) and inserts directly, like the nudge crons; context_* stay NULL exactly as before,
-- so the push body selection in supabase/functions/push-notification is unchanged.

----------------------------------------------------------------------
-- 1. private.create_trip_reminders
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_trip_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip     RECORD;
  v_days     INT;
  v_title    TEXT;
  v_body     TEXT;
  v_count    INT := 0;
  v_inserted INT;
  v_today    DATE := CURRENT_DATE;
BEGIN
  FOR v_trip IN
    SELECT id, title, start_date
    FROM public.trips
    WHERE deleted_at IS NULL
      AND is_example = false
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

    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body,
      related_type, related_id,
      context_entity, context_trip, context_creator
    )
    SELECT
      v_trip.id, tm.user_id, 'reminder', v_title, v_body,
      'trip', v_trip.id,
      NULL, NULL, NULL
    FROM public.trip_members tm
    LEFT JOIN public.notification_preferences np
      ON np.user_id = tm.user_id AND np.trip_id = tm.trip_id
    WHERE tm.trip_id = v_trip.id
      AND COALESCE(np.reminder, TRUE);

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_count := v_count + v_inserted;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- 2. private.create_planning_nudge_notifications
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_planning_nudge_notifications()
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
    SELECT picked.user_id, picked.trip_id, picked.trip_title
    FROM (
      -- Each user's most recently ended REAL trip (must be 14+ days ago).
      SELECT DISTINCT ON (tm.user_id)
        tm.user_id,
        t.id    AS trip_id,
        t.title AS trip_title
      FROM public.trip_members tm
      JOIN public.trips t ON t.id = tm.trip_id
      WHERE t.deleted_at IS NULL
        AND t.is_example = false
        AND t.end_date < CURRENT_DATE - INTERVAL '14 days'
        -- User has no real trip that ended within the last 14 days or is still upcoming.
        -- (Ensures the user's MOST RECENT trip is truly 14+ days old.)
        AND NOT EXISTS (
          SELECT 1
          FROM public.trip_members tm2
          JOIN public.trips t2 ON t2.id = tm2.trip_id
          WHERE tm2.user_id = tm.user_id
            AND t2.deleted_at IS NULL
            AND t2.is_example = false
            AND t2.end_date >= CURRENT_DATE - INTERVAL '14 days'
        )
        -- Spacing: no planning_nudge sent to this user in the last 14 days.
        AND NOT EXISTS (
          SELECT 1
          FROM public.notifications n
          WHERE n.user_id       = tm.user_id
            AND n.related_type  = 'planning_nudge'
            AND n.created_at   >= NOW() - INTERVAL '14 days'
        )
        -- Cap: at most 3 planning nudges per user, ever. Previously this re-fired every 14 days forever.
        AND (
          SELECT COUNT(*)
          FROM public.notifications n
          WHERE n.user_id      = tm.user_id
            AND n.related_type = 'planning_nudge'
        ) < 3
      ORDER BY tm.user_id, t.end_date DESC
    ) picked
    -- Preference gate AFTER picking the trip: a user who muted their latest trip must not be nudged
    -- "about" an older one instead.
    LEFT JOIN public.notification_preferences np
      ON np.user_id = picked.user_id AND np.trip_id = picked.trip_id
    WHERE COALESCE(np.reminder, TRUE)
  LOOP
    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body,
      related_type, related_id,
      context_entity, context_trip, context_creator
    ) VALUES (
      v_rec.trip_id,
      v_rec.user_id,
      'reminder',
      'Ready for your next trip?',
      '"' || v_rec.trip_title || '" was great! Start planning your next adventure.',
      'planning_nudge',
      v_rec.trip_id,
      NULL,
      v_rec.trip_title,
      NULL
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- 3. private.create_guest_nudge_notifications
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_guest_nudge_notifications()
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
    SELECT tm.user_id, tm.trip_id, t.title AS trip_title
    FROM public.trip_members tm
    JOIN public.trips t ON t.id = tm.trip_id
    LEFT JOIN public.notification_preferences np
      ON np.user_id = tm.user_id AND np.trip_id = tm.trip_id
    WHERE t.deleted_at IS NULL
      AND t.is_example = false
      AND t.end_date = CURRENT_DATE - 1
      AND tm.role IN ('participant', 'guest')
      AND COALESCE(np.reminder, TRUE)
      -- User has never been an organizer of any trip.
      AND NOT EXISTS (
        SELECT 1
        FROM public.trip_members tm2
        WHERE tm2.user_id = tm.user_id
          AND tm2.role    = 'organizer'
      )
      -- Dedup: no guest_nudge already sent for this user+trip.
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id      = tm.user_id
          AND n.trip_id      = tm.trip_id
          AND n.related_type = 'guest_nudge'
      )
  LOOP
    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body,
      related_type, related_id,
      context_entity, context_trip, context_creator
    ) VALUES (
      v_rec.trip_id,
      v_rec.user_id,
      'reminder',
      'Plan your own trip!',
      'You helped plan "' || v_rec.trip_title || '". Create your own trip — it''s free!',
      'guest_nudge',
      v_rec.trip_id,
      NULL,
      v_rec.trip_title,
      NULL
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- 4. private.create_review_nudge_notifications — preference gate only
--    (base body: 20260917100000_review_nudge_exclude_example_and_guests.sql)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_review_nudge_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip RECORD;
  v_member RECORD;
  v_count INT := 0;
BEGIN
  FOR v_trip IN
    SELECT id, title
    FROM public.trips
    WHERE deleted_at IS NULL
      AND is_example = false
      AND review_nudge_sent_at IS NULL
      AND end_date IS NOT NULL
      -- Trip ended at least 12 hours ago (end_date is a date, assume end of day UTC)
      AND (end_date::TIMESTAMP + INTERVAL '1 day' + INTERVAL '12 hours') < NOW()
  LOOP
    FOR v_member IN
      SELECT tm.user_id
      FROM public.trip_members tm
      JOIN public.users u ON u.id = tm.user_id
      LEFT JOIN public.notification_preferences np
        ON np.user_id = tm.user_id AND np.trip_id = tm.trip_id
      WHERE tm.trip_id = v_trip.id
        AND u.is_guest = false
        AND COALESCE(np.reminder, TRUE)
    LOOP
      INSERT INTO public.notifications (
        trip_id, user_id, type, title, body,
        related_type, related_id,
        context_entity, context_trip, context_creator
      ) VALUES (
        v_trip.id,
        v_member.user_id,
        'reminder',
        'Enjoying Vacationist?',
        'Your trip is over — we''d love a quick rating!',
        'review_nudge',
        NULL,
        NULL,
        v_trip.title,
        NULL
      );

      v_count := v_count + 1;
    END LOOP;

    UPDATE public.trips
       SET review_nudge_sent_at = NOW()
     WHERE id = v_trip.id;
  END LOOP;

  RETURN v_count;
END;
$$;
