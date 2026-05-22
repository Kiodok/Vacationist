-- Make the denormalized trip_id column nullable on all 7 child tables.
--
-- The BEFORE INSERT triggers (from migration 20260523000001) always populate
-- trip_id from the parent row and raise an exception if the parent is not found.
-- Data integrity is enforced by the trigger, not the NOT NULL constraint.
--
-- Making the column nullable ensures Supabase's generated TypeScript types mark
-- trip_id as optional in Insert types, so callers don't need to supply it —
-- the trigger owns it.

ALTER TABLE public.activity_votes          ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE public.accommodation_votes     ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE public.transfer_flight_votes   ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE public.transfer_flight_passengers ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE public.transfer_vehicle_passengers ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE public.expense_splits          ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE public.shopping_items          ALTER COLUMN trip_id DROP NOT NULL;
