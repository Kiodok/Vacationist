-- Fix: two overloads of private.create_trip_notification causing ambiguity (Task 14)
-- and missing pg_trigger_depth() guard causing excessive edge function invocations (Task 13).
-- Also adds targeted notification when lost_found target_user changes (Task 11)
-- and notification when a resolved case is re-opened (Task 12).
--
-- Root cause:
--   20260608200000_notification_i18n_context.sql added a 10-param version of
--   private.create_trip_notification WITHOUT dropping the original 7-param version
--   from 20260522213022 / 20260527000001. This causes PostgreSQL to reject calls
--   with NULL arguments (type unknown) because it cannot determine which overload to use.
--
--   The same migration also removed the pg_trigger_depth() >= 1 guard, so every
--   trigger-fired notification attempted an immediate net.http_post() that pg_net
--   silently drops. The notification stayed with push_sent_at IS NULL and was
--   retried by pg_cron every 5 minutes — forever if the edge function never set
--   push_sent_at (e.g. user has no push token).

----------------------------------------------------------------------
-- 1. DROP the old 7-param overload
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS private.create_trip_notification(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID);

----------------------------------------------------------------------
-- 2. REWRITE 10-param version — restore pg_trigger_depth() guard
--    (pattern from 20260527000001_fix_push_dispatch_polling.sql)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_trip_notification(
  p_trip_id          UUID,
  p_exclude_user_id  UUID,
  p_type             TEXT,
  p_title            TEXT,
  p_body             TEXT     DEFAULT NULL,
  p_related_type     TEXT     DEFAULT NULL,
  p_related_id       UUID     DEFAULT NULL,
  p_context_entity   TEXT     DEFAULT NULL,
  p_context_trip     TEXT     DEFAULT NULL,
  p_context_creator  TEXT     DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member           RECORD;
  v_notification_id  UUID;
  v_notification_ids UUID[]  := '{}';
  v_user_ids         UUID[]  := '{}';
  v_edge_fn_url      TEXT;
  v_service_key      TEXT;
  v_in_trigger       BOOLEAN;
BEGIN
  v_in_trigger := (pg_trigger_depth() >= 1);

  PERFORM set_config('app.batch_push_pending', 'true', true);

  FOR v_member IN
    SELECT user_id
    FROM public.trip_members
    WHERE trip_id = p_trip_id
      AND user_id != p_exclude_user_id
  LOOP
    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body,
      related_type, related_id,
      context_entity, context_trip, context_creator
    ) VALUES (
      p_trip_id,
      v_member.user_id,
      p_type,
      p_title,
      p_body,
      p_related_type,
      p_related_id,
      p_context_entity,
      p_context_trip,
      p_context_creator
    )
    RETURNING id INTO v_notification_id;

    v_notification_ids := v_notification_ids || v_notification_id;
    v_user_ids         := v_user_ids         || v_member.user_id;
  END LOOP;

  PERFORM set_config('app.batch_push_pending', 'false', true);

  IF array_length(v_notification_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Inside a trigger (depth >= 1): pg_net drops HTTP jobs silently.
  -- The pg_cron polling job picks up push_sent_at IS NULL rows within ~60 s.
  IF v_in_trigger THEN
    RETURN;
  END IF;

  -- Depth 0 (e.g. send_organizer_nudge RPC): dispatch immediately as one batch.
  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_edge_fn_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_service_role_key'
  LIMIT 1;

  IF v_edge_fn_url IS NULL OR v_service_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'batch',            true,
      'trip_id',          p_trip_id,
      'type',             p_type,
      'title',            p_title,
      'body',             p_body,
      'related_type',     p_related_type,
      'related_id',       p_related_id,
      'notification_ids', v_notification_ids,
      'user_ids',         v_user_ids,
      'context_entity',   p_context_entity,
      'context_trip',     p_context_trip,
      'context_creator',  p_context_creator
    )
  );
END;
$$;

----------------------------------------------------------------------
-- 3. UPDATE send_organizer_nudge to call 10-param signature explicitly
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
  v_caller      UUID := auth.uid();
  v_nudge_count INTEGER;
  v_actor_name  TEXT;
  v_trip_title  TEXT;
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

  SELECT COUNT(*) INTO v_nudge_count
  FROM public.notifications
  WHERE trip_id = p_trip_id
    AND type = 'reminder'
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_nudge_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit: max 3 nudges per trip per hour';
  END IF;

  SELECT name  INTO v_actor_name FROM public.users WHERE id = v_caller;
  SELECT title INTO v_trip_title FROM public.trips WHERE id = p_trip_id;

  PERFORM private.create_trip_notification(
    p_trip_id,
    v_caller,
    'reminder',
    trim(p_title),
    trim(p_body),
    NULL::TEXT,
    NULL::UUID,
    NULL::TEXT,
    v_trip_title,
    v_actor_name
  );
END;
$$;

----------------------------------------------------------------------
-- 4. UPDATE dispatch_pending_push_notifications to include context fields
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
-- 5. NOTIFY when lost_found target_user is set or changed (Task 11)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_lost_found_target_user_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_creator_name TEXT;
  v_trip_title   TEXT;
  v_notif_title  TEXT;
BEGIN
  IF NEW.target_user IS NOT DISTINCT FROM OLD.target_user THEN
    RETURN NEW;
  END IF;

  IF NEW.target_user IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_resolved THEN
    RETURN NEW;
  END IF;

  SELECT name  INTO v_creator_name FROM public.users WHERE id = auth.uid();
  SELECT title INTO v_trip_title   FROM public.trips WHERE id = NEW.trip_id;

  v_notif_title := CASE
    WHEN NEW.case_type LIKE 'found_%' THEN 'Item found'
    ELSE 'Item lost'
  END;

  INSERT INTO public.notifications (
    trip_id, user_id, type, title, body, related_type, related_id,
    context_entity, context_trip, context_creator
  ) VALUES (
    NEW.trip_id,
    NEW.target_user,
    'lost_found',
    v_notif_title,
    COALESCE(v_creator_name, 'Someone') || ' thinks you may have: "' || NEW.title || '".',
    'lost_found_case',
    NEW.id,
    NEW.title,
    v_trip_title,
    v_creator_name
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_lost_found_target_user_changed ON public.lost_found_cases;

CREATE TRIGGER notify_lost_found_target_user_changed
  AFTER UPDATE ON public.lost_found_cases
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_lost_found_target_user_changed();

----------------------------------------------------------------------
-- 6. EXTEND notify_lost_found_resolved to also fire on re-open (Task 12)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_lost_found_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_title TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT title INTO v_trip_title FROM public.trips WHERE id = NEW.trip_id;
  SELECT name  INTO v_actor_name FROM public.users WHERE id = auth.uid();

  -- Case resolved: FALSE → TRUE
  IF OLD.is_resolved = FALSE AND NEW.is_resolved = TRUE THEN
    PERFORM private.create_trip_notification(
      NEW.trip_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      'lost_found',
      'Case resolved',
      '"' || NEW.title || '" has been marked as resolved in "'
        || COALESCE(v_trip_title, 'your trip') || '".',
      'lost_found_case',
      NEW.id,
      NEW.title,
      v_trip_title,
      v_actor_name
    );
    RETURN NEW;
  END IF;

  -- Case re-opened: TRUE → FALSE
  IF OLD.is_resolved = TRUE AND NEW.is_resolved = FALSE THEN
    PERFORM private.create_trip_notification(
      NEW.trip_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      'lost_found',
      'Case reopened',
      '"' || NEW.title || '" has been reopened in "'
        || COALESCE(v_trip_title, 'your trip') || '".',
      'lost_found_case',
      NEW.id,
      NEW.title,
      v_trip_title,
      v_actor_name
    );

    IF NEW.target_user IS NOT NULL THEN
      INSERT INTO public.notifications (
        trip_id, user_id, type, title, body, related_type, related_id,
        context_entity, context_trip, context_creator
      ) VALUES (
        NEW.trip_id,
        NEW.target_user,
        'lost_found',
        CASE WHEN NEW.case_type LIKE 'found_%' THEN 'Item found' ELSE 'Item lost' END,
        COALESCE(v_actor_name, 'Someone') || ' thinks you may have: "' || NEW.title || '".',
        'lost_found_case',
        NEW.id,
        NEW.title,
        v_trip_title,
        v_actor_name
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
