-- Allow 'outbound-return' direction for vehicles
-- Set REPLICA IDENTITY FULL on vehicles and rentals so soft-delete UPDATE events
-- carry the full row (including trip_id) to all realtime subscribers

ALTER TABLE public.transfer_vehicles
  DROP CONSTRAINT transfer_vehicles_direction_check;

ALTER TABLE public.transfer_vehicles
  ADD CONSTRAINT transfer_vehicles_direction_check
  CHECK (direction IN ('outbound', 'return', 'outbound-return'));

ALTER TABLE public.transfer_vehicles REPLICA IDENTITY FULL;
ALTER TABLE public.transfer_rentals REPLICA IDENTITY FULL;
