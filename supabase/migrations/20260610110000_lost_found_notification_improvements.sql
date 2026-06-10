-- Lost & Found notification improvements (#9).
--
-- Previous behaviour when target_user IS NOT NULL (e.g. "found item with known owner"):
--   Only the target user received a notification; all other trip members were excluded.
--
-- Fix:
--   1. When target_user IS NULL: unchanged — broadcast to all members except creator.
--   2. When target_user IS NOT NULL:
--        a. Send a targeted notification to target_user with a personal body.
--        b. Also notify all OTHER members (excluding creator and target_user) with a
--           general broadcast body so the whole group stays informed.
--   3. New notify_lost_found_resolved() AFTER UPDATE trigger: when is_resolved changes
--      FALSE → TRUE, broadcast a resolution notification to all trip members.

----------------------------------------------------------------------
-- 1. Rewrite notify_new_lost_found_case
----------------------------------------------------------------------
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
  v_member       RECORD;
BEGIN
  SELECT name  INTO v_creator_name FROM public.users WHERE id = NEW.created_by;
  SELECT title INTO v_trip_title   FROM public.trips  WHERE id = NEW.trip_id;

  v_notif_title := CASE
    WHEN NEW.case_type LIKE 'found_%' THEN 'Item found'
    ELSE 'Item lost'
  END;

  IF NEW.target_user IS NULL THEN
    -- No specific person implicated — broadcast to all members except the reporter.
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
    -- Targeted notification for the specific person implicated.
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

    -- General broadcast for everyone else (excluding reporter and the implicated person
    -- who already received the targeted notification above).
    FOR v_member IN
      SELECT user_id FROM public.trip_members
      WHERE trip_id  = NEW.trip_id
        AND user_id != NEW.created_by
        AND user_id != NEW.target_user
    LOOP
      INSERT INTO public.notifications (
        trip_id, user_id, type, title, body, related_type, related_id,
        context_entity, context_trip, context_creator
      ) VALUES (
        NEW.trip_id,
        v_member.user_id,
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
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 2. New: notify all members when a case is marked as resolved
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_lost_found_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_title    TEXT;
  v_resolver_name TEXT;
BEGIN
  IF NOT (OLD.is_resolved = FALSE AND NEW.is_resolved = TRUE) THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_trip_title    FROM public.trips WHERE id = NEW.trip_id;
  SELECT name  INTO v_resolver_name FROM public.users WHERE id = auth.uid();

  -- Notify everyone — use the nil UUID so create_trip_notification excludes nobody.
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
    v_resolver_name
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_lost_found_resolved ON public.lost_found_cases;

CREATE TRIGGER notify_lost_found_resolved
  AFTER UPDATE ON public.lost_found_cases
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_lost_found_resolved();
