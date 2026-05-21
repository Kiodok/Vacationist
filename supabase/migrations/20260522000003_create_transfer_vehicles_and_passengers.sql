-- Phase 7c: Transfer – Vehicles & Passengers
--
-- Creates:
--   public.transfer_vehicles          – personal cars per trip with direction
--   public.transfer_vehicle_passengers – trip members in a vehicle (with driver flag)
--   soft_delete_transfer_vehicle()    – SECURITY DEFINER: organizer or participant-creator only

----------------------------------------------------------------------
-- 1. TRANSFER_VEHICLES TABLE
----------------------------------------------------------------------

CREATE TABLE public.transfer_vehicles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) <= 100),
  direction   TEXT NOT NULL CHECK (direction IN ('outbound', 'return')),
  notes       TEXT CHECK (char_length(notes) <= 500),
  created_by  UUID NOT NULL REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.transfer_vehicles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER transfer_vehicles_updated_at
  BEFORE UPDATE ON public.transfer_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: trip members can view non-deleted vehicles
CREATE POLICY "transfer_vehicles_select_member"
  ON public.transfer_vehicles FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: any trip member can create a vehicle
CREATE POLICY "transfer_vehicles_insert_member"
  ON public.transfer_vehicles FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: organizer or creator
CREATE POLICY "transfer_vehicles_update_member"
  ON public.transfer_vehicles FOR UPDATE TO authenticated
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
-- 2. SOFT DELETE TRANSFER VEHICLE (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_transfer_vehicle(p_vehicle_id UUID)
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
    FROM public.transfer_vehicles
   WHERE id = p_vehicle_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found';
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

  UPDATE public.transfer_vehicles
     SET deleted_at = NOW()
   WHERE id = p_vehicle_id;
END;
$$;

----------------------------------------------------------------------
-- 3. TRANSFER_VEHICLE_PASSENGERS TABLE
----------------------------------------------------------------------

CREATE TABLE public.transfer_vehicle_passengers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID NOT NULL REFERENCES public.transfer_vehicles(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_driver   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, user_id)
);

ALTER TABLE public.transfer_vehicle_passengers ENABLE ROW LEVEL SECURITY;

-- SELECT: trip member (via vehicle -> trip)
CREATE POLICY "transfer_vehicle_passengers_select_member"
  ON public.transfer_vehicle_passengers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_vehicles v
      WHERE v.id = vehicle_id
        AND v.deleted_at IS NULL
        AND private.is_trip_member(v.trip_id, auth.uid())
    )
  );

-- INSERT: organizer or vehicle creator
CREATE POLICY "transfer_vehicle_passengers_insert_manager"
  ON public.transfer_vehicle_passengers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transfer_vehicles v
      WHERE v.id = vehicle_id
        AND v.deleted_at IS NULL
        AND (
          private.is_trip_organizer(v.trip_id, auth.uid())
          OR v.created_by = auth.uid()
        )
    )
  );

-- UPDATE: organizer or vehicle creator (for toggling is_driver)
CREATE POLICY "transfer_vehicle_passengers_update_manager"
  ON public.transfer_vehicle_passengers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_vehicles v
      WHERE v.id = vehicle_id
        AND v.deleted_at IS NULL
        AND (
          private.is_trip_organizer(v.trip_id, auth.uid())
          OR v.created_by = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transfer_vehicles v
      WHERE v.id = vehicle_id
        AND v.deleted_at IS NULL
        AND (
          private.is_trip_organizer(v.trip_id, auth.uid())
          OR v.created_by = auth.uid()
        )
    )
  );

-- DELETE: organizer or vehicle creator
CREATE POLICY "transfer_vehicle_passengers_delete_manager"
  ON public.transfer_vehicle_passengers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_vehicles v
      WHERE v.id = vehicle_id
        AND v.deleted_at IS NULL
        AND (
          private.is_trip_organizer(v.trip_id, auth.uid())
          OR v.created_by = auth.uid()
        )
    )
  );

----------------------------------------------------------------------
-- 4. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_transfer_vehicles_trip_id ON public.transfer_vehicles(trip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transfer_vehicles_created_by ON public.transfer_vehicles(created_by);
CREATE INDEX idx_transfer_vehicle_passengers_vehicle_id ON public.transfer_vehicle_passengers(vehicle_id);
