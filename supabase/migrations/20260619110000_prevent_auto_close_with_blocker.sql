-- Prevent auto-close from triggering when any group_blocker vote exists.
-- This keeps cards with a blocker vote in the "Discuss" section until an organizer
-- or creator explicitly marks them as planned.

----------------------------------------------------------------------
-- Activities
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_finalize_activity_voting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id      UUID;
  v_voting_open  BOOLEAN;
  v_auto_close   BOOLEAN;
  v_member_count INT;
  v_vote_count   INT;
  v_blocker_count INT;
BEGIN
  SELECT a.trip_id, a.voting_open, a.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.activities a
   WHERE a.id = NEW.activity_id;

  IF NOT v_voting_open THEN
    RETURN NEW;
  END IF;

  IF NOT v_auto_close THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.activity_votes
   WHERE activity_id = NEW.activity_id
     AND vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.activity_votes
   WHERE activity_id = NEW.activity_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.activities
       SET voting_open = FALSE
     WHERE id = NEW.activity_id;
  END IF;

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- Accommodations
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_finalize_accommodation_voting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id      UUID;
  v_voting_open  BOOLEAN;
  v_auto_close   BOOLEAN;
  v_member_count INT;
  v_vote_count   INT;
  v_blocker_count INT;
BEGIN
  SELECT a.trip_id, a.voting_open, a.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.accommodations a
   WHERE a.id = NEW.accommodation_id;

  IF NOT v_voting_open THEN
    RETURN NEW;
  END IF;

  IF NOT v_auto_close THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.accommodation_votes
   WHERE accommodation_id = NEW.accommodation_id
     AND vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.accommodation_votes
   WHERE accommodation_id = NEW.accommodation_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.accommodations
       SET voting_open = FALSE
     WHERE id = NEW.accommodation_id;
  END IF;

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- Transfer flights
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_finalize_flight_voting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id      UUID;
  v_voting_open  BOOLEAN;
  v_auto_close   BOOLEAN;
  v_member_count INT;
  v_vote_count   INT;
  v_blocker_count INT;
BEGIN
  SELECT f.trip_id, f.voting_open, f.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.transfer_flights f
   WHERE f.id = NEW.flight_id;

  IF NOT v_voting_open THEN
    RETURN NEW;
  END IF;

  IF NOT v_auto_close THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.transfer_flight_votes
   WHERE flight_id = NEW.flight_id
     AND vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.transfer_flight_votes
   WHERE flight_id = NEW.flight_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.transfer_flights
       SET voting_open = FALSE
     WHERE id = NEW.flight_id;
  END IF;

  RETURN NEW;
END;
$$;
