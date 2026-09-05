-- v1.34.1 task 2 follow-up: 20260905150000 added a 4-arg book_transfer_flight
-- (p_return_flight_number). Because the argument count changed, CREATE OR REPLACE created a
-- second overload rather than replacing the 3-arg one — leaving both live. A supabase-js
-- .rpc('book_transfer_flight', { p_flight_id, p_flight_number, p_booking_reference }) call then
-- matches BOTH signatures and PostgREST raises "Could not choose the best candidate function".
-- Drop the old 3-arg overload so only the 4-arg version remains.
-- (Same pattern as 20260809110001_drop_old_update_expense_overload.sql.)

DROP FUNCTION IF EXISTS public.book_transfer_flight(uuid, text, text);
