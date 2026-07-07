-- Fix shared packing notifications:
--   1. Pass context columns in handle_shared_packing_item_insert so body is i18n-translatable.
--   2. Fix notify_shared_packing_item_claimed: body was NULL; add context columns so the
--      client can render a translated body instead of showing nothing.

----------------------------------------------------------------------
-- 1. handle_shared_packing_item_insert
--    Adds context_entity / context_trip / context_creator to both
--    create_trip_notification calls.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.handle_shared_packing_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_creator_name TEXT;
  v_trip_title   TEXT;
BEGIN
  SELECT name  INTO v_creator_name FROM public.users  WHERE id = NEW.created_by;
  SELECT title INTO v_trip_title   FROM public.trips  WHERE id = NEW.trip_id;

  IF NEW.item_type = 'everyone' THEN
    -- Mirror each shared item into every member's private packing list.
    INSERT INTO public.packing_items (trip_id, user_id, category, title, source_shared_item_id)
    SELECT NEW.trip_id, user_id, 'Shared', NEW.title, NEW.id
    FROM public.trip_members WHERE trip_id = NEW.trip_id
    ON CONFLICT DO NOTHING;

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
  -- 'who_has' items: no auto-insert; notification fires on claim (see below).

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 2. notify_shared_packing_item_claimed
--    Previously stored body = NULL and no context columns.
--    Now stores a meaningful body and all three context columns.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_shared_packing_item_claimed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claimer_name TEXT;
  v_trip_title   TEXT;
BEGIN
  IF OLD.claimed_by IS NULL AND NEW.claimed_by IS NOT NULL THEN
    SELECT name  INTO v_claimer_name FROM public.users WHERE id = NEW.claimed_by;
    SELECT title INTO v_trip_title   FROM public.trips WHERE id = NEW.trip_id;

    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body,
      related_type, related_id,
      context_entity, context_trip, context_creator
    ) VALUES (
      NEW.trip_id,
      NEW.created_by,
      'shared_packing',
      COALESCE(v_claimer_name, 'Someone') || ' claimed: ' || NEW.title,
      'For "' || COALESCE(v_trip_title, 'your trip') || '".',
      'shared_packing_item',
      NEW.id,
      NEW.title,
      v_trip_title,
      v_claimer_name
    );
  END IF;
  RETURN NEW;
END;
$$;
