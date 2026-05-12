-- Restrict non-organizer activity updates:
-- Only organizers may change voting_open or status.
-- The creator (participant/guest) can update content fields only.

CREATE OR REPLACE FUNCTION public.check_activity_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
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

CREATE OR REPLACE TRIGGER on_activity_update_check
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.check_activity_update_permissions();
