-- Phase 7c: Transfer – Enable Realtime
--
-- Adds all transfer tables to the Supabase Realtime publication.
-- REPLICA IDENTITY FULL is set on junction/vote tables so DELETE events
-- include all columns, not just the PK — required for client-side cache invalidation.

ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_flights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_flight_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_flight_passengers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_vehicle_passengers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_rentals;

ALTER TABLE public.transfer_flight_votes REPLICA IDENTITY FULL;
ALTER TABLE public.transfer_flight_passengers REPLICA IDENTITY FULL;
ALTER TABLE public.transfer_vehicle_passengers REPLICA IDENTITY FULL;
