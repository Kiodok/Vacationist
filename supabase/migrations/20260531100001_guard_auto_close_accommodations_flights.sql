-- Guard auto_close changes on accommodations and transfer_flights so only
-- organizers can toggle it — matching the existing activity trigger added in
-- 20260531100000_add_auto_close_to_voting_entities.sql.

----------------------------------------------------------------------
-- Accommodations
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_accommodation_auto_close_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.auto_close IS DISTINCT FROM NEW.auto_close THEN
    IF NOT private.is_trip_organizer(NEW.trip_id, auth.uid()) THEN
      RAISE EXCEPTION 'Only organizers can change auto_close';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_accommodation_auto_close_check
  BEFORE UPDATE ON public.accommodations
  FOR EACH ROW EXECUTE FUNCTION public.check_accommodation_auto_close_permissions();

----------------------------------------------------------------------
-- Transfer Flights
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_transfer_flight_auto_close_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.auto_close IS DISTINCT FROM NEW.auto_close THEN
    IF NOT private.is_trip_organizer(NEW.trip_id, auth.uid()) THEN
      RAISE EXCEPTION 'Only organizers can change auto_close';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_transfer_flight_auto_close_check
  BEFORE UPDATE ON public.transfer_flights
  FOR EACH ROW EXECUTE FUNCTION public.check_transfer_flight_auto_close_permissions();
