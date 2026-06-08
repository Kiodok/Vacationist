-- Add context columns to notifications for i18n-aware push body construction.
--
-- The edge function uses these columns to interpolate translated body templates
-- with entity/trip/creator names, replacing the previous English-only DB bodies.
--
-- context_entity  : title of the entity (activity name, expense title, etc.)
-- context_trip    : title of the trip
-- context_creator : display name of the person who triggered the notification

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS context_entity  TEXT,
  ADD COLUMN IF NOT EXISTS context_trip    TEXT,
  ADD COLUMN IF NOT EXISTS context_creator TEXT;

----------------------------------------------------------------------
-- Update the core helper: add context params + preserve batch dispatch.
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
BEGIN
  -- Signal the per-row trigger to skip — we dispatch in batch below.
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

  SELECT decrypted_secret INTO v_edge_fn_url
    FROM vault.decrypted_secrets WHERE name = 'push_notification_edge_fn_url' LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'push_notification_service_role_key' LIMIT 1;

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
-- Update per-row dispatch trigger to include context fields in payload.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.dispatch_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge_fn_url TEXT;
  v_service_key TEXT;
BEGIN
  IF current_setting('app.batch_push_pending', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_edge_fn_url
    FROM vault.decrypted_secrets WHERE name = 'push_notification_edge_fn_url' LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'push_notification_service_role_key' LIMIT 1;

  IF v_edge_fn_url IS NULL OR v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'notification_id',  NEW.id,
      'trip_id',          NEW.trip_id,
      'user_id',          NEW.user_id,
      'type',             NEW.type,
      'title',            NEW.title,
      'body',             NEW.body,
      'related_type',     NEW.related_type,
      'related_id',       NEW.related_id,
      'context_entity',   NEW.context_entity,
      'context_trip',     NEW.context_trip,
      'context_creator',  NEW.context_creator
    )
  );

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- Update all trigger functions to pass context fields.
----------------------------------------------------------------------

-- 1. NEW ACTIVITY
CREATE OR REPLACE FUNCTION private.notify_new_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_title   TEXT;
  v_creator_name TEXT;
BEGIN
  SELECT title INTO v_trip_title   FROM public.trips WHERE id = NEW.trip_id;
  SELECT name  INTO v_creator_name FROM public.users WHERE id = NEW.created_by;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.created_by,
    'new_activity',
    'New activity added',
    COALESCE(v_creator_name, 'Someone') || ' added "' || NEW.title
      || '" to "' || COALESCE(v_trip_title, 'your trip') || '".',
    'activity',
    NEW.id,
    NEW.title,
    v_trip_title,
    v_creator_name
  );
  RETURN NEW;
END;
$$;

-- 2. NEW EXPENSE
CREATE OR REPLACE FUNCTION private.notify_new_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_title   TEXT;
  v_creator_name TEXT;
BEGIN
  SELECT title INTO v_trip_title   FROM public.trips WHERE id = NEW.trip_id;
  SELECT name  INTO v_creator_name FROM public.users WHERE id = NEW.created_by;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.created_by,
    'expense_change',
    'New expense added',
    COALESCE(v_creator_name, 'Someone') || ' added "' || NEW.title
      || '" (' || NEW.amount::TEXT || ' ' || NEW.currency
      || ') to "' || COALESCE(v_trip_title, 'your trip') || '".',
    'expense',
    NEW.id,
    NEW.title,
    v_trip_title,
    v_creator_name
  );
  RETURN NEW;
END;
$$;

-- 3. NEW MEMBER
CREATE OR REPLACE FUNCTION private.notify_new_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member_name TEXT;
  v_trip_title  TEXT;
BEGIN
  SELECT name  INTO v_member_name FROM public.users WHERE id = NEW.user_id;
  SELECT title INTO v_trip_title  FROM public.trips WHERE id = NEW.trip_id;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.user_id,
    'new_member',
    COALESCE(v_member_name, 'Someone') || ' joined the trip',
    COALESCE(v_member_name, 'A new member') || ' is now part of "'
      || COALESCE(v_trip_title, 'your trip') || '".',
    'member',
    NEW.user_id,
    NULL,
    v_trip_title,
    v_member_name
  );
  RETURN NEW;
END;
$$;

-- 4. ACTIVITY VOTING FINALIZED
CREATE OR REPLACE FUNCTION private.notify_activity_vote_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_title TEXT;
BEGIN
  IF NOT (OLD.voting_open = TRUE AND NEW.voting_open = FALSE) THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_trip_title FROM public.trips WHERE id = NEW.trip_id;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'vote_finalized',
    'Activity voting finalized',
    'Voting is closed for "' || NEW.title || '" in "'
      || COALESCE(v_trip_title, 'your trip') || '".',
    'activity',
    NEW.id,
    NEW.title,
    v_trip_title,
    NULL
  );
  RETURN NEW;
END;
$$;

-- 5. ACCOMMODATION VOTING FINALIZED
CREATE OR REPLACE FUNCTION private.notify_accommodation_vote_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_title TEXT;
BEGIN
  IF NOT (OLD.voting_open = TRUE AND NEW.voting_open = FALSE) THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_trip_title FROM public.trips WHERE id = NEW.trip_id;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'vote_finalized',
    'Place voting finalized',
    'Voting is closed for "' || NEW.title || '" in "'
      || COALESCE(v_trip_title, 'your trip') || '".',
    'accommodation',
    NEW.id,
    NEW.title,
    v_trip_title,
    NULL
  );
  RETURN NEW;
END;
$$;

-- 6. ACTIVITY SCHEDULE CHANGE
CREATE OR REPLACE FUNCTION private.notify_schedule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_title TEXT;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NOT (
    NEW.activity_date IS DISTINCT FROM OLD.activity_date OR
    NEW.start_time    IS DISTINCT FROM OLD.start_time    OR
    NEW.end_time      IS DISTINCT FROM OLD.end_time
  ) THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_trip_title FROM public.trips WHERE id = NEW.trip_id;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    auth.uid(),
    'schedule_change',
    'Schedule updated',
    '"' || NEW.title || '" in "' || COALESCE(v_trip_title, 'your trip')
      || '" has been rescheduled.',
    'activity',
    NEW.id,
    NEW.title,
    v_trip_title,
    NULL
  );
  RETURN NEW;
END;
$$;

-- 7. NEW LOST & FOUND CASE
CREATE OR REPLACE FUNCTION private.notify_new_lost_found_case()
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
  SELECT name  INTO v_creator_name FROM public.users WHERE id = NEW.created_by;
  SELECT title INTO v_trip_title   FROM public.trips  WHERE id = NEW.trip_id;

  v_notif_title := CASE
    WHEN NEW.case_type LIKE 'found_%' THEN 'Item found'
    ELSE 'Item lost'
  END;

  IF NEW.target_user IS NULL THEN
    PERFORM private.create_trip_notification(
      NEW.trip_id,
      NEW.created_by,
      'lost_found',
      v_notif_title,
      COALESCE(v_creator_name, 'Someone') || ' reported "' || NEW.title
        || '" in "' || COALESCE(v_trip_title, 'your trip') || '".',
      'lost_found_case',
      NEW.id,
      NEW.title,
      v_trip_title,
      v_creator_name
    );
  ELSE
    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body, related_type, related_id,
      context_entity, context_trip, context_creator
    )
    VALUES (
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
  END IF;

  RETURN NEW;
END;
$$;

-- 8 & 9. SHARED PACKING ITEM INSERT
CREATE OR REPLACE FUNCTION private.handle_shared_packing_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member       RECORD;
  v_creator_name TEXT;
  v_trip_title   TEXT;
BEGIN
  SELECT name  INTO v_creator_name FROM public.users WHERE id = NEW.created_by;
  SELECT title INTO v_trip_title   FROM public.trips  WHERE id = NEW.trip_id;

  IF NEW.item_type = 'everyone' THEN
    FOR v_member IN
      SELECT user_id FROM public.trip_members WHERE trip_id = NEW.trip_id
    LOOP
      INSERT INTO public.packing_items (trip_id, user_id, category, title, source_shared_item_id)
      VALUES (NEW.trip_id, v_member.user_id, 'Shared', NEW.title, NEW.id)
      ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM private.create_trip_notification(
      NEW.trip_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      'shared_packing',
      'Everyone brings: ' || NEW.title,
      COALESCE(v_creator_name, 'Someone') || ' added "' || NEW.title
        || '" for everyone in "' || COALESCE(v_trip_title, 'your trip') || '".',
      'shared_packing_item',
      NEW.id,
      NEW.title,
      v_trip_title,
      v_creator_name
    );

  ELSIF NEW.item_type = 'i_got_it' THEN
    INSERT INTO public.packing_items (trip_id, user_id, category, title, source_shared_item_id)
    VALUES (NEW.trip_id, NEW.created_by, 'Shared', NEW.title, NEW.id)
    ON CONFLICT DO NOTHING;

    PERFORM private.create_trip_notification(
      NEW.trip_id,
      NEW.created_by,
      'shared_packing',
      COALESCE(v_creator_name, 'Someone') || ' is bringing: ' || NEW.title,
      'For "' || COALESCE(v_trip_title, 'your trip') || '".',
      'shared_packing_item',
      NEW.id,
      NEW.title,
      v_trip_title,
      v_creator_name
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 10. SHARED PACKING ITEM CLAIMED
CREATE OR REPLACE FUNCTION private.notify_shared_packing_item_claimed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claimer_name TEXT;
BEGIN
  IF OLD.claimed_by IS NULL AND NEW.claimed_by IS NOT NULL THEN
    SELECT name INTO v_claimer_name FROM public.users WHERE id = NEW.claimed_by;

    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body, related_type, related_id,
      context_entity, context_trip, context_creator
    )
    VALUES (
      NEW.trip_id,
      NEW.created_by,
      'shared_packing',
      COALESCE(v_claimer_name, 'Someone') || ' claimed: ' || NEW.title,
      NULL,
      'shared_packing_item',
      NEW.id,
      NEW.title,
      NULL,
      v_claimer_name
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 11. TRANSFER FLIGHT VOTING FINALIZED
CREATE OR REPLACE FUNCTION private.notify_transfer_flight_vote_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_title TEXT;
BEGIN
  IF NOT (OLD.voting_open = TRUE AND NEW.voting_open = FALSE) THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_trip_title FROM public.trips WHERE id = NEW.trip_id;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'vote_finalized',
    'Flight voting finalized',
    'Voting is closed for "' || NEW.title || '" in "'
      || COALESCE(v_trip_title, 'your trip') || '".',
    'transfer_flight',
    NEW.id,
    NEW.title,
    v_trip_title,
    NULL
  );
  RETURN NEW;
END;
$$;
