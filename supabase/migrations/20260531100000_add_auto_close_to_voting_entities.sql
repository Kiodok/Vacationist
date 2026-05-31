-- Add auto_close flag to voting entities.
-- When FALSE (default), votes never auto-close after all members have voted;
-- the organizer must end the vote manually.
-- When TRUE, the existing trigger behaviour is preserved: voting closes
-- automatically once every trip member has cast a vote.

ALTER TABLE public.activities
  ADD COLUMN auto_close BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.accommodations
  ADD COLUMN auto_close BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.transfer_flights
  ADD COLUMN auto_close BOOLEAN NOT NULL DEFAULT FALSE;

----------------------------------------------------------------------
-- Update auto_finalize_activity_voting to respect auto_close
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
-- Update auto_finalize_accommodation_voting to respect auto_close
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
-- Update auto_finalize_transfer_flight_voting to respect auto_close
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_finalize_transfer_flight_voting()
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

----------------------------------------------------------------------
-- Extend check_activity_update_permissions to guard auto_close
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_activity_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
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
-- Recreate create_activity RPC to accept auto_close parameter
-- (DROP required because PostgreSQL forbids changing function signature
--  via CREATE OR REPLACE)
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_activity(UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, TIME, TIME, TEXT, TEXT, BOOLEAN);

CREATE FUNCTION public.create_activity(
  p_trip_id               UUID,
  p_title                 TEXT,
  p_description           TEXT    DEFAULT NULL,
  p_category              TEXT    DEFAULT NULL,
  p_cost_estimate         NUMERIC DEFAULT NULL,
  p_activity_date         DATE    DEFAULT NULL,
  p_start_time            TIME    DEFAULT NULL,
  p_end_time              TIME    DEFAULT NULL,
  p_external_url          TEXT    DEFAULT NULL,
  p_maps_url              TEXT    DEFAULT NULL,
  p_reservation_required  BOOLEAN DEFAULT FALSE,
  p_auto_close            BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  INSERT INTO public.activities (
    trip_id, title, description, category, cost_estimate,
    activity_date, start_time, end_time, external_url, maps_url,
    reservation_required, auto_close, created_by
  )
  VALUES (
    p_trip_id, p_title, p_description, p_category, p_cost_estimate,
    p_activity_date, p_start_time, p_end_time, p_external_url, p_maps_url,
    p_reservation_required, p_auto_close, v_caller
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
