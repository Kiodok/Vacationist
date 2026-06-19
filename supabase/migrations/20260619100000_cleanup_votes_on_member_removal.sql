-- When a user is removed from a trip (trip_members row deleted), clean up their votes
-- for all activities, accommodations, and flights belonging to that trip.
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

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_votes_on_member_removal
  AFTER DELETE ON public.trip_members
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_votes_on_member_removal();
