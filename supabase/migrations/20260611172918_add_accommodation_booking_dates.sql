-- Accommodation Booking Dates (Task 6)
--
-- Adds check_in_date and check_out_date to accommodations so a base can be
-- marked as "booked" with concrete stay dates. Multiple bases per trip can be booked.
-- No additional RLS needed — existing policies cover these columns.

ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS check_in_date  DATE,
  ADD COLUMN IF NOT EXISTS check_out_date DATE;
