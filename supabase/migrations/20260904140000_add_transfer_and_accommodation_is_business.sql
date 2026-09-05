-- v1.34.0 item 9: extend the "business expense" flag (expenses.is_business,
-- 20260901150000_add_expense_is_business.sql) to accommodations ("Base") and the priced
-- Transfer sub-types (flights, rentals, public transport) so a business trip's booked hotel and
-- flights can appear in the same business-expense summary export as manually logged expenses.
-- transfer_vehicles is intentionally excluded — it has no price column, nothing to mark as a
-- business cost.

ALTER TABLE public.accommodations
  ADD COLUMN is_business BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.transfer_flights
  ADD COLUMN is_business BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.transfer_rentals
  ADD COLUMN is_business BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.transfer_public_transport
  ADD COLUMN is_business BOOLEAN NOT NULL DEFAULT FALSE;
