-- Extend cleanup_votes_on_member_removal to also remove transfer vehicle passengers
-- and prework preferences when a user leaves a trip.
-- Fixes "Unknown" display in VehicleCard and GroupSummarySection after member removal.

CREATE OR REPLACE FUNCTION public.cleanup_votes_on_member_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.activity_votes
  WHERE user_id = OLD.user_id
    AND activity_id IN (
      SELECT id FROM public.activities WHERE trip_id = OLD.trip_id AND deleted_at IS NULL
    );

  DELETE FROM public.accommodation_votes
  WHERE user_id = OLD.user_id
    AND accommodation_id IN (
      SELECT id FROM public.accommodations WHERE trip_id = OLD.trip_id AND deleted_at IS NULL
    );

  DELETE FROM public.transfer_flight_votes
  WHERE user_id = OLD.user_id
    AND flight_id IN (
      SELECT id FROM public.transfer_flights WHERE trip_id = OLD.trip_id AND deleted_at IS NULL
    );

  -- Remove passenger rows from all vehicles in this trip
  DELETE FROM public.transfer_vehicle_passengers
  WHERE user_id = OLD.user_id
    AND vehicle_id IN (
      SELECT id FROM public.transfer_vehicles
      WHERE trip_id = OLD.trip_id AND deleted_at IS NULL
    );

  -- Remove prework preferences for this trip
  DELETE FROM public.prework_preferences
  WHERE user_id = OLD.user_id
    AND trip_id = OLD.trip_id;

  RETURN OLD;
END;
$$;
