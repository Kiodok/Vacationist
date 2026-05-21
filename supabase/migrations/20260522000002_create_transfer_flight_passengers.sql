-- Phase 7c: Transfer – Flight Passengers
--
-- Creates:
--   public.transfer_flight_passengers  – trip members assigned to a booked flight
--   verify_flight_booked_before_passenger() trigger
--   set_transfer_flight_passengers()   – SECURITY DEFINER: atomic replace passenger list (organizer only)

----------------------------------------------------------------------
-- 1. TRANSFER_FLIGHT_PASSENGERS TABLE
----------------------------------------------------------------------

CREATE TABLE public.transfer_flight_passengers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id   UUID NOT NULL REFERENCES public.transfer_flights(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flight_id, user_id)
);

ALTER TABLE public.transfer_flight_passengers ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------------------
-- 2. TRIGGER: ONLY ALLOW PASSENGERS ON BOOKED FLIGHTS
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_flight_booked_before_passenger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
    FROM public.transfer_flights
   WHERE id = NEW.flight_id;

  IF v_status IS DISTINCT FROM 'booked' THEN
    RAISE EXCEPTION 'Passengers can only be assigned to booked flights';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_transfer_flight_passenger_insert_verify
  BEFORE INSERT ON public.transfer_flight_passengers
  FOR EACH ROW EXECUTE FUNCTION public.verify_flight_booked_before_passenger();

----------------------------------------------------------------------
-- 3. RLS POLICIES
----------------------------------------------------------------------

-- SELECT: trip member (via flight -> trip)
CREATE POLICY "transfer_flight_passengers_select_member"
  ON public.transfer_flight_passengers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_flights f
      WHERE f.id = flight_id
        AND private.is_trip_member(f.trip_id, auth.uid())
    )
  );

-- INSERT: organizer only
CREATE POLICY "transfer_flight_passengers_insert_organizer"
  ON public.transfer_flight_passengers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transfer_flights f
      WHERE f.id = flight_id
        AND private.is_trip_organizer(f.trip_id, auth.uid())
    )
  );

-- DELETE: organizer only
CREATE POLICY "transfer_flight_passengers_delete_organizer"
  ON public.transfer_flight_passengers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_flights f
      WHERE f.id = flight_id
        AND private.is_trip_organizer(f.trip_id, auth.uid())
    )
  );

----------------------------------------------------------------------
-- 4. SET FLIGHT PASSENGERS (SECURITY DEFINER)
----------------------------------------------------------------------
-- Atomically replaces the full passenger list for a flight.
-- Organizer only. Deletes existing and re-inserts the given user IDs.

CREATE OR REPLACE FUNCTION public.set_transfer_flight_passengers(
  p_flight_id UUID,
  p_user_ids  UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
  v_status  TEXT;
  v_caller  UUID := auth.uid();
  v_uid     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, status
    INTO v_trip_id, v_status
    FROM public.transfer_flights
   WHERE id = p_flight_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Flight not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only organizers can manage passengers';
  END IF;

  IF v_status IS DISTINCT FROM 'booked' THEN
    RAISE EXCEPTION 'Passengers can only be assigned to booked flights';
  END IF;

  -- Validate all user IDs are trip members
  FOREACH v_uid IN ARRAY p_user_ids LOOP
    IF NOT private.is_trip_member(v_trip_id, v_uid) THEN
      RAISE EXCEPTION 'User % is not a trip member', v_uid;
    END IF;
  END LOOP;

  -- Replace passenger list atomically
  DELETE FROM public.transfer_flight_passengers WHERE flight_id = p_flight_id;

  INSERT INTO public.transfer_flight_passengers (flight_id, user_id)
  SELECT p_flight_id, unnest(p_user_ids);
END;
$$;

----------------------------------------------------------------------
-- 5. INDEX
----------------------------------------------------------------------

CREATE INDEX idx_transfer_flight_passengers_flight_id ON public.transfer_flight_passengers(flight_id);
