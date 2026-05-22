-- Phase 7c fix: Add outbound-return direction + return leg columns to transfer_flights

-- 1. Extend the direction check constraint to allow 'outbound-return'
ALTER TABLE public.transfer_flights
  DROP CONSTRAINT transfer_flights_direction_check;

ALTER TABLE public.transfer_flights
  ADD CONSTRAINT transfer_flights_direction_check
  CHECK (direction IN ('outbound', 'return', 'outbound-return'));

-- 2. Add return-leg columns (populated only when direction = 'outbound-return')
ALTER TABLE public.transfer_flights
  ADD COLUMN return_departure_airport TEXT CHECK (char_length(return_departure_airport) <= 100),
  ADD COLUMN return_arrival_airport   TEXT CHECK (char_length(return_arrival_airport) <= 100),
  ADD COLUMN return_departure_time    TIMESTAMPTZ,
  ADD COLUMN return_arrival_time      TIMESTAMPTZ;

-- 3. Enable full replica identity so realtime carries the full row on INSERT/UPDATE/DELETE
ALTER TABLE public.transfer_flights REPLICA IDENTITY FULL;
