-- Security fix: unvalidated target_user in lost_found_cases allowed any trip member
-- to insert a case targeting a user outside the trip, causing the notification trigger
-- to deliver a push notification to an arbitrary platform user.
--
-- Fix is two-layered:
--   1. BEFORE INSERT OR UPDATE trigger rejects target_user values that are not trip members.
--   2. notify_new_lost_found_case is updated to add a membership guard as defense-in-depth.

----------------------------------------------------------------------
-- 1. BEFORE trigger: validate target_user is a trip member (if set)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_lost_found_target_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.target_user IS NOT NULL
     AND NOT private.is_trip_member(NEW.trip_id, NEW.target_user)
  THEN
    RAISE EXCEPTION 'target_user must be a member of the trip';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_lost_found_target_user
  BEFORE INSERT OR UPDATE ON public.lost_found_cases
  FOR EACH ROW EXECUTE FUNCTION public.restrict_lost_found_target_user();

----------------------------------------------------------------------
-- 2. Defense-in-depth: add membership guard inside the notification
--    trigger so a non-member target_user can never receive a push
--    even if the row somehow bypasses the constraint above.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.notify_new_lost_found_case()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.target_user IS NULL THEN
    -- Broadcast to all members except creator
    PERFORM private.create_trip_notification(
      NEW.trip_id,
      NEW.created_by,
      'lost_found',
      'Lost & Found',
      NEW.title,
      'lost_found_case',
      NEW.id
    );
  ELSE
    -- Only notify the specific target_user — but only if they are a trip member.
    IF private.is_trip_member(NEW.trip_id, NEW.target_user) THEN
      INSERT INTO public.notifications (trip_id, user_id, type, title, body, related_type, related_id)
      VALUES (
        NEW.trip_id,
        NEW.target_user,
        'lost_found',
        'Lost & Found',
        NEW.title,
        'lost_found_case',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
