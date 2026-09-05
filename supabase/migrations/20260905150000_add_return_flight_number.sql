-- v1.34.1 task 2: a round-trip ("outbound-return") flight booked as a single row needs a
-- separate outbound and return flight number. The single booking reference stays shared.
--
-- `flight_number` keeps its existing meaning (the outbound number, or the only number for a
-- one-way flight); `return_flight_number` is populated only for `direction = 'outbound-return'`
-- rows. Both remain optional — booking never blocks on them (matches the existing UX where the
-- number is often filled in later, from the airline confirmation email).

ALTER TABLE public.transfer_flights
  ADD COLUMN return_flight_number TEXT CHECK (char_length(return_flight_number) <= 20);

-- Extend book_transfer_flight with the new optional 4th argument. Body is otherwise identical to
-- the current definition (20260620000000_blocker_as_workflow_escalation.sql §4) — organizer-only,
-- flips status/voting_open, COALESCEs the passed booking fields, clears group_blocker votes.
-- The new parameter is defaulted and last, so existing 3-arg callers keep working unchanged.
CREATE OR REPLACE FUNCTION public.book_transfer_flight(
  p_flight_id            UUID,
  p_flight_number        TEXT DEFAULT NULL,
  p_booking_reference    TEXT DEFAULT NULL,
  p_return_flight_number TEXT DEFAULT NULL
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
     SET status               = 'booked',
         voting_open          = FALSE,
         flight_number        = COALESCE(p_flight_number, flight_number),
         return_flight_number = COALESCE(p_return_flight_number, return_flight_number),
         booking_reference    = COALESCE(p_booking_reference, booking_reference)
   WHERE id = p_flight_id;

  DELETE FROM public.transfer_flight_votes
   WHERE flight_id = p_flight_id AND vote = 'group_blocker';
END;
$$;
