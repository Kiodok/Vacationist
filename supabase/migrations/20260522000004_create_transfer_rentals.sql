-- Phase 7c: Transfer – Rental Cars
--
-- Creates:
--   public.transfer_rentals      – rental car booking details per trip
--   soft_delete_transfer_rental() – SECURITY DEFINER: organizer or participant-creator only

----------------------------------------------------------------------
-- 1. TRANSFER_RENTALS TABLE
----------------------------------------------------------------------

CREATE TABLE public.transfer_rentals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title            TEXT NOT NULL CHECK (char_length(title) <= 100),
  company          TEXT CHECK (char_length(company) <= 100),
  pickup_location  TEXT CHECK (char_length(pickup_location) <= 200),
  dropoff_location TEXT CHECK (char_length(dropoff_location) <= 200),
  pickup_date      TIMESTAMPTZ,
  dropoff_date     TIMESTAMPTZ,
  booking_reference TEXT CHECK (char_length(booking_reference) <= 50),
  price_total      NUMERIC(10,2),
  external_url     TEXT CHECK (char_length(external_url) <= 2048),
  notes            TEXT CHECK (char_length(notes) <= 500),
  created_by       UUID NOT NULL REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.transfer_rentals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER transfer_rentals_updated_at
  BEFORE UPDATE ON public.transfer_rentals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transfer_rentals
  ADD CONSTRAINT transfer_rentals_external_url_https
  CHECK (external_url IS NULL OR external_url LIKE 'https://%');

-- SELECT: trip members can view non-deleted rentals
CREATE POLICY "transfer_rentals_select_member"
  ON public.transfer_rentals FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: any trip member can create a rental
CREATE POLICY "transfer_rentals_insert_member"
  ON public.transfer_rentals FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: organizer or creator
CREATE POLICY "transfer_rentals_update_member"
  ON public.transfer_rentals FOR UPDATE TO authenticated
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
-- 2. SOFT DELETE TRANSFER RENTAL (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_transfer_rental(p_rental_id UUID)
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
    FROM public.transfer_rentals
   WHERE id = p_rental_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Rental not found';
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

  UPDATE public.transfer_rentals
     SET deleted_at = NOW()
   WHERE id = p_rental_id;
END;
$$;

----------------------------------------------------------------------
-- 3. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_transfer_rentals_trip_id ON public.transfer_rentals(trip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transfer_rentals_created_by ON public.transfer_rentals(created_by);
