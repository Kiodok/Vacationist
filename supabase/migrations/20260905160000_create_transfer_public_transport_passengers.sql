-- v1.34.1 task 4: public transport gets a passenger list, mirroring transfer_flight_passengers
-- (20260522000002) but with the transfer_vehicles permission model instead of flights':
--   * no is_driver flag
--   * no status/"booked" gate (transfer_public_transport has no status lifecycle)
--   * INSERT/DELETE by the passenger themselves (self join/leave), the PT entry's creator, OR a
--     trip organizer — folded straight into the RLS policy, so no join_/leave_ RPC pair is
--     needed (unlike vehicles, whose RLS predates self-assign).
--
-- Denormalized nullable trip_id + BEFORE INSERT trigger for the Realtime `trip_id=eq.<id>`
-- filter, exactly like the sibling junction tables (20260523000001 / 20260523000002).
-- REPLICA IDENTITY FULL so a DELETE's OLD payload carries trip_id for that filter.
--
-- user_id FK is ON DELETE CASCADE (same as transfer_flight_passengers), so delete_own_account()
-- needs no new reassignment line.

----------------------------------------------------------------------
-- 1. TABLE
----------------------------------------------------------------------

CREATE TABLE public.transfer_public_transport_passengers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_transport_id UUID NOT NULL REFERENCES public.transfer_public_transport(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id             UUID REFERENCES public.trips(id),  -- denormalized; trigger owns it
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (public_transport_id, user_id)
);

ALTER TABLE public.transfer_public_transport_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_public_transport_passengers REPLICA IDENTITY FULL;

----------------------------------------------------------------------
-- 2. DENORMALIZED trip_id TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_transfer_public_transport_passenger_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT p.trip_id INTO NEW.trip_id
    FROM public.transfer_public_transport p
   WHERE p.id = NEW.public_transport_id;
  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent public transport entry not found for transfer_public_transport_passenger';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_transfer_public_transport_passenger_trip_id
  BEFORE INSERT ON public.transfer_public_transport_passengers
  FOR EACH ROW EXECUTE FUNCTION public.set_transfer_public_transport_passenger_trip_id();

----------------------------------------------------------------------
-- 3. RLS
----------------------------------------------------------------------

-- SELECT: any trip member (via parent -> trip). Parent's own deleted_at is filtered in the API
-- layer, consistent with transfer_public_transport's own SELECT policy.
CREATE POLICY "tpt_passengers_select_member"
  ON public.transfer_public_transport_passengers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_public_transport p
      WHERE p.id = public_transport_id
        AND private.is_trip_member(p.trip_id, auth.uid())
    )
  );

-- INSERT: the passenger themselves (self-join), the PT entry's creator, or a trip organizer.
CREATE POLICY "tpt_passengers_insert_self_or_manager"
  ON public.transfer_public_transport_passengers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transfer_public_transport p
      WHERE p.id = public_transport_id
        AND p.deleted_at IS NULL
        AND private.is_trip_member(p.trip_id, auth.uid())
        AND (
          user_id = auth.uid()
          OR p.created_by = auth.uid()
          OR private.is_trip_organizer(p.trip_id, auth.uid())
        )
    )
  );

-- DELETE: same predicate (self-leave, or creator/organizer removing anyone).
CREATE POLICY "tpt_passengers_delete_self_or_manager"
  ON public.transfer_public_transport_passengers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_public_transport p
      WHERE p.id = public_transport_id
        AND private.is_trip_member(p.trip_id, auth.uid())
        AND (
          user_id = auth.uid()
          OR p.created_by = auth.uid()
          OR private.is_trip_organizer(p.trip_id, auth.uid())
        )
    )
  );

----------------------------------------------------------------------
-- 4. REALTIME + INDEXES
----------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_public_transport_passengers;

CREATE INDEX idx_tpt_passengers_public_transport_id
  ON public.transfer_public_transport_passengers(public_transport_id);
CREATE INDEX idx_tpt_passengers_trip_id
  ON public.transfer_public_transport_passengers(trip_id);
CREATE INDEX idx_tpt_passengers_user_id
  ON public.transfer_public_transport_passengers(user_id);
