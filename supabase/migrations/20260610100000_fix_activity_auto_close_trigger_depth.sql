-- Fix auto-close voting broken (#14).
--
-- Root cause: migration 20260531100000 recreated check_activity_update_permissions
-- to also guard auto_close, but dropped the pg_trigger_depth() > 1 bypass that
-- 20260513000001 had added. When auto_finalize_activity_voting() (depth 1) sets
-- voting_open=FALSE on activities, the permission check fires again at depth 2
-- with auth.uid() = the voter — who may not be an organizer — causing an exception.
--
-- Two fixes:
--   1. Restore the pg_trigger_depth() > 1 bypass in check_activity_update_permissions.
--   2. Add a BEFORE UPDATE trigger (retroactive_auto_close_activity) that handles the
--      case where an organizer enables auto_close after all members have already voted:
--      the existing auto_finalize trigger only fires on NEW votes, so it never fires
--      retroactively. This trigger closes voting in the same UPDATE statement.

----------------------------------------------------------------------
-- 1. Restore trigger-depth bypass in check_activity_update_permissions
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_activity_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Allow system-level updates (e.g. auto_finalize_activity_voting running at
  -- pg_trigger_depth() >= 2) to bypass organizer checks — auth.uid() is not
  -- meaningful inside a trigger stack.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF (OLD.voting_open IS DISTINCT FROM NEW.voting_open)
     OR (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.auto_close IS DISTINCT FROM NEW.auto_close) THEN
    IF NOT private.is_trip_organizer(NEW.trip_id, auth.uid()) THEN
      RAISE EXCEPTION 'Only organizers can change voting_open, status, or auto_close';
    END IF;
  END IF;

  IF OLD.trip_id IS DISTINCT FROM NEW.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 2. Retroactive auto-close: when organizer enables auto_close and all
--    members have already voted, close voting in the same statement.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retroactive_auto_close_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_member_count INT;
  v_vote_count   INT;
BEGIN
  -- Only act when auto_close is being switched from FALSE to TRUE while voting
  -- is still open.
  IF NOT (OLD.auto_close = FALSE AND NEW.auto_close = TRUE AND NEW.voting_open = TRUE) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = NEW.trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.activity_votes
   WHERE activity_id = NEW.id;

  IF v_vote_count >= v_member_count THEN
    NEW.voting_open := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS retroactive_auto_close_activity ON public.activities;

CREATE TRIGGER retroactive_auto_close_activity
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.retroactive_auto_close_activity();
