-- Fix: 56+ edge function invocations every 5 minutes
--
-- Root causes:
--
-- 1. dispatch_pending_push_notifications has no age limit. Before the June 11
--    "always mark push_sent_at" fix, any notification sent to a user with no push
--    tokens or with preferences off was never marked as sent. These rows accumulated
--    and are retried every 5 minutes forever → currently ~56 rows, producing ~56
--    edge function calls every 5-minute retry window.
--    Fix: one-time cleanup + auto-expire rows older than 24 hours in each cron tick.
--
-- 2. send_organizer_nudge was rewritten in 20260611172912 with three regressions:
--    a. Rate limit reverted to COUNT(*) — for a trip with 4+ members, 1 nudge creates
--       N-1 rows, hitting the limit after (3 / (N-1)) nudges instead of 3.
--    b. related_type set to NULL — rate limit no longer distinguishes nudges from
--       trip reminders (type='reminder', related_type='trip'), so reminders count.
--    c. context_trip set to v_trip_title — breaks the edge function isNudge detection
--       (isNudge = type === 'reminder' && !context?.trip), causing nudge push
--       notifications to show the generic "Trip reminder" template instead of the
--       organizer's custom title/body.
--    Fix: restore send_organizer_nudge from 20260523195815 (correct rate limiting)
--    and update it to call the 10-param create_trip_notification with context_trip=NULL.

----------------------------------------------------------------------
-- 1. One-time cleanup: stop retrying all currently-stuck notifications.
--    Push delivery for these is irrelevant — they are hours/days old.
----------------------------------------------------------------------
UPDATE public.notifications
SET push_sent_at = NOW()
WHERE push_sent_at IS NULL;

----------------------------------------------------------------------
-- 2. Rewrite dispatch_pending_push_notifications with auto-expiry guard.
--    Notifications older than 24 hours are marked as sent immediately
--    without attempting an HTTP call, preventing permanent accumulation
--    if the edge function ever fails to set push_sent_at.
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

  -- Auto-expire stale pending notifications (>24 h old).
  -- Push notifications this old are not actionable for the user. Marking them
  -- as sent without HTTP dispatch prevents permanent retry accumulation caused
  -- by any future transient edge function failure.
  UPDATE public.notifications
  SET push_sent_at = NOW()
  WHERE push_sent_at IS NULL
    AND created_at < NOW() - INTERVAL '24 hours';

  -- Dispatch fresh pending notifications (within the last 24 hours).
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
        'notification_id',  v_rec.id,
        'trip_id',          v_rec.trip_id,
        'user_id',          v_rec.user_id,
        'type',             v_rec.type,
        'title',            v_rec.title,
        'body',             v_rec.body,
        'related_type',     v_rec.related_type,
        'related_id',       v_rec.related_id,
        'context_entity',   v_rec.context_entity,
        'context_trip',     v_rec.context_trip,
        'context_creator',  v_rec.context_creator
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- 3. Restore send_organizer_nudge (correct version from 20260523195815)
--    updated to call the 10-param create_trip_notification signature.
--
--    Key invariants:
--    - related_type = 'nudge' distinguishes nudges from trip reminders
--      (related_type = 'trip') in the rate-limit query.
--    - related_id = v_nudge_id (unique UUID per nudge call) allows
--      COUNT(DISTINCT related_id) to count events, not rows.
--    - context_trip = NULL so the edge function correctly sets isNudge = true
--      and uses the organizer's custom title/body for the push payload.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_organizer_nudge(
  p_trip_id UUID,
  p_title   TEXT,
  p_body    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller      UUID    := auth.uid();
  v_nudge_count INTEGER;
  v_nudge_id    UUID    := gen_random_uuid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_organizer(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only trip organizers can send nudges';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Nudge title is required';
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Nudge body is required';
  END IF;

  IF length(trim(p_title)) > 100 THEN
    RAISE EXCEPTION 'Nudge title must be 100 characters or fewer';
  END IF;
  IF length(trim(p_body)) > 300 THEN
    RAISE EXCEPTION 'Nudge body must be 300 characters or fewer';
  END IF;

  -- Count distinct nudge events (not rows) in the last hour.
  -- related_type = 'nudge' excludes trip reminders (related_type = 'trip').
  SELECT COUNT(DISTINCT related_id) INTO v_nudge_count
  FROM public.notifications
  WHERE trip_id      = p_trip_id
    AND type         = 'reminder'
    AND related_type = 'nudge'
    AND related_id   IS NOT NULL
    AND created_at   > NOW() - INTERVAL '1 hour';

  IF v_nudge_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit: max 3 nudges per trip per hour';
  END IF;

  PERFORM private.create_trip_notification(
    p_trip_id,
    v_caller,
    'reminder',
    trim(p_title),
    trim(p_body),
    'nudge',       -- related_type: distinguishes nudges from trip reminders
    v_nudge_id,   -- related_id: unique per nudge event for accurate rate limiting
    NULL::TEXT,    -- context_entity
    NULL::TEXT,    -- context_trip: MUST be NULL — edge fn uses !context?.trip to
                   --   detect nudges and preserve the organizer's custom title/body
    NULL::TEXT     -- context_creator
  );
END;
$$;
