-- Blocker votes as workflow escalation
--
-- Two behavioural changes:
--   1. close_*_voting RPCs (and book_transfer_flight) now delete all group_blocker
--      votes after closing voting. When an organiser/creator marks a Discuss item
--      as Planned the blockers are wiped, surfacing a clean vote summary.
--   2. New AFTER DELETE triggers re-evaluate auto-close when a user removes their
--      own group_blocker vote. If it was the last blocker and auto_close is on and
--      every member has voted, voting closes automatically.

----------------------------------------------------------------------
-- 1. close_activity_voting – delete blockers after closing
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_activity_voting(p_activity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
  v_caller  UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id INTO v_trip_id
    FROM public.activities
   WHERE id = p_activity_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only organizers can close voting';
  END IF;

  UPDATE public.activities SET voting_open = FALSE WHERE id = p_activity_id;
  DELETE FROM public.activity_votes
   WHERE activity_id = p_activity_id AND vote = 'group_blocker';
END;
$$;

----------------------------------------------------------------------
-- 2. close_accommodation_voting – delete blockers after closing
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_accommodation_voting(p_accommodation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
  v_caller  UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id INTO v_trip_id
    FROM public.accommodations
   WHERE id = p_accommodation_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Accommodation not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only organizers can close voting';
  END IF;

  UPDATE public.accommodations SET voting_open = FALSE WHERE id = p_accommodation_id;
  DELETE FROM public.accommodation_votes
   WHERE accommodation_id = p_accommodation_id AND vote = 'group_blocker';
END;
$$;

----------------------------------------------------------------------
-- 3. close_transfer_flight_voting – delete blockers after closing
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_transfer_flight_voting(p_flight_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
  v_caller  UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id INTO v_trip_id
    FROM public.transfer_flights
   WHERE id = p_flight_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Flight not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only organizers can close voting';
  END IF;

  UPDATE public.transfer_flights SET voting_open = FALSE WHERE id = p_flight_id;
  DELETE FROM public.transfer_flight_votes
   WHERE flight_id = p_flight_id AND vote = 'group_blocker';
END;
$$;

----------------------------------------------------------------------
-- 4. book_transfer_flight – delete blockers after booking
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_transfer_flight(
  p_flight_id         UUID,
  p_flight_number     TEXT DEFAULT NULL,
  p_booking_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
  v_caller  UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id INTO v_trip_id
    FROM public.transfer_flights
   WHERE id = p_flight_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Flight not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only organizers can book a flight';
  END IF;

  UPDATE public.transfer_flights
     SET status            = 'booked',
         voting_open       = FALSE,
         flight_number     = COALESCE(p_flight_number, flight_number),
         booking_reference = COALESCE(p_booking_reference, booking_reference)
   WHERE id = p_flight_id;

  DELETE FROM public.transfer_flight_votes
   WHERE flight_id = p_flight_id AND vote = 'group_blocker';
END;
$$;

----------------------------------------------------------------------
-- 5a. Activity: re-evaluate auto-close when last blocker is removed
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_finalize_activity_voting_on_blocker_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id       UUID;
  v_voting_open   BOOLEAN;
  v_auto_close    BOOLEAN;
  v_blocker_count INT;
  v_member_count  INT;
  v_vote_count    INT;
BEGIN
  IF OLD.vote <> 'group_blocker' THEN
    RETURN OLD;
  END IF;

  SELECT a.trip_id, a.voting_open, a.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.activities a
   WHERE a.id = OLD.activity_id;

  IF NOT v_voting_open THEN
    RETURN OLD;
  END IF;

  IF NOT v_auto_close THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.activity_votes
   WHERE activity_id = OLD.activity_id
     AND vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.activity_votes
   WHERE activity_id = OLD.activity_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.activities SET voting_open = FALSE WHERE id = OLD.activity_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER on_activity_vote_deleted
  AFTER DELETE ON public.activity_votes
  FOR EACH ROW EXECUTE FUNCTION public.auto_finalize_activity_voting_on_blocker_removal();

----------------------------------------------------------------------
-- 5b. Accommodation: re-evaluate auto-close when last blocker is removed
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_finalize_accommodation_voting_on_blocker_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id       UUID;
  v_voting_open   BOOLEAN;
  v_auto_close    BOOLEAN;
  v_blocker_count INT;
  v_member_count  INT;
  v_vote_count    INT;
BEGIN
  IF OLD.vote <> 'group_blocker' THEN
    RETURN OLD;
  END IF;

  SELECT a.trip_id, a.voting_open, a.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.accommodations a
   WHERE a.id = OLD.accommodation_id;

  IF NOT v_voting_open THEN
    RETURN OLD;
  END IF;

  IF NOT v_auto_close THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.accommodation_votes
   WHERE accommodation_id = OLD.accommodation_id
     AND vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.accommodation_votes
   WHERE accommodation_id = OLD.accommodation_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.accommodations SET voting_open = FALSE WHERE id = OLD.accommodation_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER on_accommodation_vote_deleted
  AFTER DELETE ON public.accommodation_votes
  FOR EACH ROW EXECUTE FUNCTION public.auto_finalize_accommodation_voting_on_blocker_removal();

----------------------------------------------------------------------
-- 5c. Transfer flight: re-evaluate auto-close when last blocker is removed
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_finalize_flight_voting_on_blocker_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id       UUID;
  v_voting_open   BOOLEAN;
  v_auto_close    BOOLEAN;
  v_blocker_count INT;
  v_member_count  INT;
  v_vote_count    INT;
BEGIN
  IF OLD.vote <> 'group_blocker' THEN
    RETURN OLD;
  END IF;

  SELECT f.trip_id, f.voting_open, f.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.transfer_flights f
   WHERE f.id = OLD.flight_id;

  IF NOT v_voting_open THEN
    RETURN OLD;
  END IF;

  IF NOT v_auto_close THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.transfer_flight_votes
   WHERE flight_id = OLD.flight_id
     AND vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.transfer_flight_votes
   WHERE flight_id = OLD.flight_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.transfer_flights SET voting_open = FALSE WHERE id = OLD.flight_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER on_transfer_flight_vote_deleted
  AFTER DELETE ON public.transfer_flight_votes
  FOR EACH ROW EXECUTE FUNCTION public.auto_finalize_flight_voting_on_blocker_removal();
