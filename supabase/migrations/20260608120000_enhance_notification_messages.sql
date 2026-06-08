-- Enhance notification messages with contextual details.
--
-- Uses CREATE OR REPLACE FUNCTION throughout — existing triggers do NOT need
-- to be recreated because they reference functions by name.
--
-- Changes:
--   1.  notify_new_activity         — body includes creator name + trip name
--   2.  notify_new_expense          — body includes creator, amount, currency + trip name
--   3.  notify_new_member           — body includes trip name (was generic "the trip")
--   4.  notify_activity_vote_finalized   — title specifies "Activity"; body adds trip name
--   5.  notify_accommodation_vote_finalized — title specifies "Place"; body adds trip name
--   6.  notify_schedule_change      — body adds trip name; wording made more natural
--   7.  notify_new_lost_found_case  — title derived from case_type; body includes creator + trip
--   8/9. handle_shared_packing_item_insert — body adds creator/trip name; i_got_it title includes creator
--  10.  notify_shared_packing_item_claimed — title includes claimer name
--  11.  NEW: notify_transfer_flight_vote_finalized (was missing entirely)

----------------------------------------------------------------------
-- 1. NEW ACTIVITY
-- Before: body = activity title only
-- After:  "<creator> added "<activity>" to "<trip>"."
----------------------------------------------------------------------
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
    NEW.id
  );
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 2. NEW EXPENSE
-- Before: body = expense title only
-- After:  "<creator> added "<title>" (<amount> <currency>) to "<trip>"."
----------------------------------------------------------------------
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
    NEW.id
  );
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 3. NEW MEMBER
-- Before: body = "<name> is now part of the trip."
-- After:  body = "<name> is now part of "<trip name>"."
----------------------------------------------------------------------
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
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 4. ACTIVITY VOTING FINALIZED
-- Before: title = "Voting finalized", body = 'Voting is closed for "<activity>".'
-- After:  title = "Activity voting finalized", body adds trip name
----------------------------------------------------------------------
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
    NEW.id
  );
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 5. ACCOMMODATION VOTING FINALIZED
-- Before: title = "Voting finalized", body = 'Voting is closed for "<accom>".'
-- After:  title = "Place voting finalized", body adds trip name
----------------------------------------------------------------------
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
    NEW.id
  );
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 6. ACTIVITY SCHEDULE CHANGE
-- Before: body = '"<activity>" has a new date or time.'
-- After:  body = '"<activity>" in "<trip>" has been rescheduled.'
----------------------------------------------------------------------
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
    NEW.id
  );
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 7. NEW LOST & FOUND CASE
-- Before: title = "Lost & Found" (always), body = case title only
-- After:  title = "Item lost" / "Item found" (derived from case_type),
--         body = "<creator> reported "<title>" in "<trip>"."
--         Targeted message: "<creator> thinks you may have: "<title>"."
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
      NEW.id
    );
  ELSE
    INSERT INTO public.notifications (trip_id, user_id, type, title, body, related_type, related_id)
    VALUES (
      NEW.trip_id,
      NEW.target_user,
      'lost_found',
      v_notif_title,
      COALESCE(v_creator_name, 'Someone') || ' thinks you may have: "' || NEW.title || '".',
      'lost_found_case',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 8 & 9. SHARED PACKING ITEM INSERT
-- everyone:  body now includes creator + trip name
-- i_got_it:  title now includes creator name; body includes trip name
----------------------------------------------------------------------
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
      NEW.id
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
      NEW.id
    );
  END IF;
  -- 'who_has' items: no auto-insert, no immediate notification (notification fires on claim)

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 10. SHARED PACKING ITEM CLAIMED
-- Before: title = "Item claimed", body = item title
-- After:  title = "<claimer> claimed: <title>", body = NULL
----------------------------------------------------------------------
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

    INSERT INTO public.notifications (trip_id, user_id, type, title, body, related_type, related_id)
    VALUES (
      NEW.trip_id,
      NEW.created_by,
      'shared_packing',
      COALESCE(v_claimer_name, 'Someone') || ' claimed: ' || NEW.title,
      NULL,
      'shared_packing_item',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 11. NEW: TRANSFER FLIGHT VOTING FINALIZED
-- Previously missing — no notification was sent when flight voting closed.
-- Mirrors the activity/accommodation pattern exactly.
----------------------------------------------------------------------
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
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_transfer_flight_vote_finalized ON public.transfer_flights;
CREATE TRIGGER trg_notify_transfer_flight_vote_finalized
  AFTER UPDATE ON public.transfer_flights
  FOR EACH ROW EXECUTE FUNCTION private.notify_transfer_flight_vote_finalized();
