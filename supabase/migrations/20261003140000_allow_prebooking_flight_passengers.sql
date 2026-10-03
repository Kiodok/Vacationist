-- v1.39.2 follow-up (2026-10-03): allow flight passengers to be assigned BEFORE booking.
--
-- Until now, transfer_flight_passengers could only be inserted once a flight's status = 'booked'
-- — enforced in two independent places (20260522000002): a BEFORE INSERT trigger on the table
-- itself, and a duplicate check inside set_transfer_flight_passengers (the only write path, via
-- SECURITY DEFINER, which bypasses RLS anyway). This was the structural reason the booking-prompt
-- added earlier today always opened with a blank Amount for flights — participant count was
-- always 0 the instant Book succeeded, since no passenger could exist yet at that moment.
--
-- Tech Lead's call: let the organizer assign passengers any time (still organizer-only — no
-- self-join, unlike public transport/vehicles), so the booking-prompt can finally prefill a real
-- price_per_person × passenger-count total. The cost-analysis RPCs (get_trip_cost_summary /
-- get_my_trip_cost_shares) are untouched — they still only count a flight once status IN
-- ('booked', 'completed'), so this migration only changes *when passengers can be assigned*, not
-- when a flight contributes to the trip total.

-- (a) Drop the BEFORE INSERT trigger + its function — nothing else depends on either.
DROP TRIGGER IF EXISTS on_transfer_flight_passenger_insert_verify ON public.transfer_flight_passengers;
DROP FUNCTION IF EXISTS public.verify_flight_booked_before_passenger();

-- (b) set_transfer_flight_passengers: same signature, same body, minus the booked-status guard.
-- Every other check stays: auth, organizer-only permission, per-user trip-membership validation,
-- atomic delete+insert replace.
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
  v_caller  UUID := auth.uid();
  v_uid     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id
    INTO v_trip_id
    FROM public.transfer_flights
   WHERE id = p_flight_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Flight not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only organizers can manage passengers';
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
