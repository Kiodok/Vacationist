-- Fix: auto_finalize_accommodation_voting trigger updates
-- accommodations.voting_open which fires restrict_accommodation_update_fields.
-- When the last voter is not an organizer, the permission check fails.
-- Skip the organizer check when the update originates from a nested trigger.

CREATE OR REPLACE FUNCTION public.restrict_accommodation_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  IF NOT private.is_trip_organizer(OLD.trip_id, auth.uid()) THEN
    IF NEW.voting_open IS DISTINCT FROM OLD.voting_open THEN
      RAISE EXCEPTION 'Only organizers can change voting_open';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only organizers can change status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
