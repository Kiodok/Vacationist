-- Code-review fix (finding 2): transfer_public_transport was added to the supabase_realtime
-- publication and is subscribed to INSERT/UPDATE/DELETE with a trip_id filter
-- (packages/api/src/transferRealtime.ts), but its creation migration
-- (20260901140000_create_transfer_public_transport.sql) never set REPLICA IDENTITY FULL on it —
-- unlike every sibling transfer table (transfer_rentals, transfer_vehicles, transfer_flights),
-- which all do (see 20260522000007_vehicle_outbound_return_and_replica_identity.sql and
-- 20260522000006_transfer_outbound_return.sql).
--
-- Without this, a hard DELETE (e.g. cascading from trip deletion) only carries the primary key
-- in its OLD payload — trip_id is missing, so Realtime's trip_id=eq.<id> filter can't match the
-- event and other trip members' clients never receive it, leaving a deleted entry silently
-- lingering in their UI until a manual refetch.

ALTER TABLE public.transfer_public_transport REPLICA IDENTITY FULL;
