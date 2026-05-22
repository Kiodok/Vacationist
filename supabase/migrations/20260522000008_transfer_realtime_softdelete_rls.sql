-- Fix realtime soft-delete propagation for transfer tables.
--
-- Root cause: the SELECT RLS policy required `deleted_at IS NULL`.
-- After a soft-delete UPDATE the new row fails that check, so Supabase
-- realtime drops the event for all other subscribers — they never see the
-- deletion. The fix is to remove `deleted_at IS NULL` from RLS and add it
-- to every explicit SELECT query in the API layer instead.

-- ── transfer_flights ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "transfer_flights_select_member" ON public.transfer_flights;

CREATE POLICY "transfer_flights_select_member"
  ON public.transfer_flights FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

-- ── transfer_vehicles ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "transfer_vehicles_select_member" ON public.transfer_vehicles;

CREATE POLICY "transfer_vehicles_select_member"
  ON public.transfer_vehicles FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

-- ── transfer_rentals ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "transfer_rentals_select_member" ON public.transfer_rentals;

CREATE POLICY "transfer_rentals_select_member"
  ON public.transfer_rentals FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));
