-- Phase 7c: Transfer – Flights & Votes
--
-- Creates:
--   public.transfer_flights         – flight options per trip with direction (outbound/return)
--   public.transfer_flight_votes    – non-numeric voting (must_do/like/open/skip/group_blocker)
--   restrict_transfer_flight_update_fields() trigger
--   auto_finalize_transfer_flight_voting() trigger
--   soft_delete_transfer_flight()   – SECURITY DEFINER: organizer or participant-creator only
--   close_transfer_flight_voting()  – SECURITY DEFINER: organizer only
--   reopen_transfer_flight_voting() – SECURITY DEFINER: organizer only
--   book_transfer_flight()          – SECURITY DEFINER: organizer only, atomic booking

----------------------------------------------------------------------
-- 1. TRANSFER_FLIGHTS TABLE
----------------------------------------------------------------------

CREATE TABLE public.transfer_flights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title               TEXT NOT NULL CHECK (char_length(title) <= 100),
  description         TEXT CHECK (char_length(description) <= 1000),
  direction           TEXT NOT NULL CHECK (direction IN ('outbound', 'return')),
  airline             TEXT CHECK (char_length(airline) <= 100),
  departure_airport   TEXT CHECK (char_length(departure_airport) <= 100),
  arrival_airport     TEXT CHECK (char_length(arrival_airport) <= 100),
  departure_time      TIMESTAMPTZ,
  arrival_time        TIMESTAMPTZ,
  price_per_person    NUMERIC(10,2),
  external_url        TEXT CHECK (char_length(external_url) <= 2048),
  flight_number       TEXT CHECK (char_length(flight_number) <= 20),
  booking_reference   TEXT CHECK (char_length(booking_reference) <= 50),
  notes               TEXT CHECK (char_length(notes) <= 500),
  status              TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'booked', 'completed')),
  voting_open         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID NOT NULL REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.transfer_flights ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER transfer_flights_updated_at
  BEFORE UPDATE ON public.transfer_flights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transfer_flights
  ADD CONSTRAINT transfer_flights_external_url_https
  CHECK (external_url IS NULL OR external_url LIKE 'https://%');

-- SELECT: trip members can view non-deleted flights
CREATE POLICY "transfer_flights_select_member"
  ON public.transfer_flights FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: any trip member can create flights
CREATE POLICY "transfer_flights_insert_member"
  ON public.transfer_flights FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: organizer can update any, creator can update own
CREATE POLICY "transfer_flights_update_member"
  ON public.transfer_flights FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      private.is_trip_organizer(trip_id, auth.uid())
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND (
      private.is_trip_organizer(trip_id, auth.uid())
      OR created_by = auth.uid()
    )
  );

----------------------------------------------------------------------
-- 2. RESTRICT UPDATE FIELDS
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_transfer_flight_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  IF NOT private.is_trip_organizer(OLD.trip_id, auth.uid()) THEN
    IF NEW.voting_open IS DISTINCT FROM OLD.voting_open THEN
      RAISE EXCEPTION 'Only organizers can change voting_open';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only organizers can change status';
    END IF;
    IF NEW.flight_number IS DISTINCT FROM OLD.flight_number THEN
      RAISE EXCEPTION 'Only organizers can set flight_number';
    END IF;
    IF NEW.booking_reference IS DISTINCT FROM OLD.booking_reference THEN
      RAISE EXCEPTION 'Only organizers can set booking_reference';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_transfer_flight_update_restrict
  BEFORE UPDATE ON public.transfer_flights
  FOR EACH ROW EXECUTE FUNCTION public.restrict_transfer_flight_update_fields();

----------------------------------------------------------------------
-- 3. TRANSFER_FLIGHT_VOTES TABLE
----------------------------------------------------------------------

CREATE TABLE public.transfer_flight_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id   UUID NOT NULL REFERENCES public.transfer_flights(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote        TEXT NOT NULL CHECK (vote IN ('must_do', 'like', 'open', 'skip', 'group_blocker')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flight_id, user_id)
);

ALTER TABLE public.transfer_flight_votes ENABLE ROW LEVEL SECURITY;

-- SELECT: trip members can see votes
CREATE POLICY "transfer_flight_votes_select_member"
  ON public.transfer_flight_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_flights f
      WHERE f.id = flight_id
        AND f.deleted_at IS NULL
        AND private.is_trip_member(f.trip_id, auth.uid())
    )
  );

-- INSERT: trip member + voting must be open
CREATE POLICY "transfer_flight_votes_insert_member"
  ON public.transfer_flight_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.transfer_flights f
      WHERE f.id = flight_id
        AND f.voting_open = TRUE
        AND f.deleted_at IS NULL
        AND private.is_trip_member(f.trip_id, auth.uid())
    )
  );

-- UPDATE: own vote + voting must be open (needed for UPSERT ON CONFLICT)
CREATE POLICY "transfer_flight_votes_update_own"
  ON public.transfer_flight_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.transfer_flights f
      WHERE f.id = flight_id
        AND f.voting_open = TRUE
        AND f.deleted_at IS NULL
    )
  );

-- DELETE: own vote + voting must be open
CREATE POLICY "transfer_flight_votes_delete_own"
  ON public.transfer_flight_votes FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.transfer_flights f
      WHERE f.id = flight_id
        AND f.voting_open = TRUE
        AND f.deleted_at IS NULL
    )
  );

----------------------------------------------------------------------
-- 4. AUTO-FINALIZE VOTING TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_finalize_transfer_flight_voting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id      UUID;
  v_voting_open  BOOLEAN;
  v_member_count INT;
  v_vote_count   INT;
BEGIN
  SELECT f.trip_id, f.voting_open
    INTO v_trip_id, v_voting_open
    FROM public.transfer_flights f
   WHERE f.id = NEW.flight_id;

  IF NOT v_voting_open THEN
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

CREATE OR REPLACE TRIGGER on_transfer_flight_vote_inserted
  AFTER INSERT OR UPDATE ON public.transfer_flight_votes
  FOR EACH ROW EXECUTE FUNCTION public.auto_finalize_transfer_flight_voting();

----------------------------------------------------------------------
-- 5. SOFT DELETE TRANSFER FLIGHT (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_transfer_flight(p_flight_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id    UUID;
  v_created_by UUID;
  v_caller     UUID := auth.uid();
  v_role       TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, created_by
    INTO v_trip_id, v_created_by
    FROM public.transfer_flights
   WHERE id = p_flight_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Flight not found';
  END IF;

  SELECT role INTO v_role
    FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  IF v_role = 'organizer' THEN
    NULL;
  ELSIF v_role = 'participant' AND v_created_by = v_caller THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.transfer_flights
     SET deleted_at = NOW()
   WHERE id = p_flight_id;
END;
$$;

----------------------------------------------------------------------
-- 6. CLOSE TRANSFER FLIGHT VOTING (SECURITY DEFINER)
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

  UPDATE public.transfer_flights
     SET voting_open = FALSE
   WHERE id = p_flight_id;
END;
$$;

----------------------------------------------------------------------
-- 7. REOPEN TRANSFER FLIGHT VOTING (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reopen_transfer_flight_voting(p_flight_id UUID)
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
    RAISE EXCEPTION 'Only organizers can re-open voting';
  END IF;

  UPDATE public.transfer_flights
     SET voting_open = TRUE
   WHERE id = p_flight_id;
END;
$$;

----------------------------------------------------------------------
-- 8. BOOK TRANSFER FLIGHT (SECURITY DEFINER)
----------------------------------------------------------------------
-- Organizer only. Atomically sets status='booked' + voting_open=FALSE.
-- Optionally sets flight_number and booking_reference in the same call.

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
END;
$$;

----------------------------------------------------------------------
-- 9. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_transfer_flights_trip_id ON public.transfer_flights(trip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transfer_flights_created_by ON public.transfer_flights(created_by);
CREATE INDEX idx_transfer_flight_votes_flight_id ON public.transfer_flight_votes(flight_id);
CREATE INDEX idx_transfer_flight_votes_user_id ON public.transfer_flight_votes(user_id);
