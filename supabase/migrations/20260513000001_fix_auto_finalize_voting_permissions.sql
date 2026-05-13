-- Fix: auto_finalize_activity_voting trigger updates activities.voting_open
-- which fires check_activity_update_permissions. When the last voter is not
-- an organizer, the permission check fails. Skip the organizer check when
-- the update originates from a nested trigger (pg_trigger_depth() > 1).

CREATE OR REPLACE FUNCTION public.check_activity_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Allow updates from nested triggers (e.g. auto_finalize_activity_voting)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- If voting_open or status changed, require organizer role
  IF (OLD.voting_open IS DISTINCT FROM NEW.voting_open)
     OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT private.is_trip_organizer(NEW.trip_id, auth.uid()) THEN
      RAISE EXCEPTION 'Only organizers can change voting_open or status';
    END IF;
  END IF;

  -- Prevent changing trip_id or created_by
  IF OLD.trip_id IS DISTINCT FROM NEW.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  RETURN NEW;
END;
$$;
