-- v1.34.0 item 12 extension: per-entity currency on Accommodations ("Base"), closing the gap
-- left when item 12 originally scoped to "priced types only" (Flights/Rentals/Public Transport).
--
-- Same reasoning as 20260904130000_add_transfer_currency_columns.sql: accommodations.price_total
-- was always displayed using the trip's LIVE base_currency. Changing a trip's currency after the
-- fact would silently reinterpret an already-booked accommodation's price with no conversion.
-- Adding a real currency column, frozen at write time, fixes this the same way it was fixed for
-- Transfers — the trip's base_currency continues to affect only expenses.
--
-- Backfill: every existing row's price was always implicitly denominated in whatever the trip's
-- base_currency was AT THE TIME — the trip's CURRENT base_currency is the best available
-- approximation for historical rows, same non-destructive backfill-then-NOT-NULL pattern as the
-- transfer currency migration.

ALTER TABLE public.accommodations
  ADD COLUMN currency TEXT REFERENCES public.currency_catalog(code);

UPDATE public.accommodations a
   SET currency = t.base_currency
  FROM public.trips t
 WHERE a.trip_id = t.id
   AND a.currency IS NULL;

ALTER TABLE public.accommodations ALTER COLUMN currency SET NOT NULL;

-- No default — every INSERT going forward (client-side, via CurrencyPickerSheet) must supply an
-- explicit currency rather than silently inheriting the trip's base_currency at insert time.
