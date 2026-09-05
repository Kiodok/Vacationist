-- v1.34.0 item 12: per-entity currency on Transfers (Flights, Rentals, Public Transport).
--
-- Why: none of these three tables carried a currency column — price_per_person/price_total
-- were always displayed using the trip's LIVE base_currency (passed down as a prop from
-- AllTransfersView). Changing a trip's currency after the fact silently reinterpreted every
-- existing flight/rental/public-transport price with no conversion (a flight booked and paid
-- in EUR "became" a BAM price the instant the trip's currency was changed to BAM). Adding a
-- real currency column, frozen at write time exactly like expenses.currency, fixes this: the
-- trip's base_currency continues to affect only expenses, as it always has.
--
-- Backfill: every existing row's price was always implicitly denominated in whatever the
-- trip's base_currency was AT THE TIME — the trip's CURRENT base_currency is the best
-- available approximation for historical rows (this migration cannot know what the trip's
-- currency was back when each row was created, only what it is now), so backfilling from the
-- live value freezes it going forward without changing what any existing price already means
-- today. Same non-destructive backfill-then-NOT-NULL pattern as expenses.exchange_rate
-- (20260809100004_add_expense_fx_columns.sql).

ALTER TABLE public.transfer_flights
  ADD COLUMN currency TEXT REFERENCES public.currency_catalog(code);

ALTER TABLE public.transfer_rentals
  ADD COLUMN currency TEXT REFERENCES public.currency_catalog(code);

ALTER TABLE public.transfer_public_transport
  ADD COLUMN currency TEXT REFERENCES public.currency_catalog(code);

UPDATE public.transfer_flights f
   SET currency = t.base_currency
  FROM public.trips t
 WHERE f.trip_id = t.id
   AND f.currency IS NULL;

UPDATE public.transfer_rentals r
   SET currency = t.base_currency
  FROM public.trips t
 WHERE r.trip_id = t.id
   AND r.currency IS NULL;

UPDATE public.transfer_public_transport p
   SET currency = t.base_currency
  FROM public.trips t
 WHERE p.trip_id = t.id
   AND p.currency IS NULL;

ALTER TABLE public.transfer_flights ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.transfer_rentals ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.transfer_public_transport ALTER COLUMN currency SET NOT NULL;

-- No default: every INSERT going forward (client-side, via CurrencyPickerSheet) must supply an
-- explicit currency rather than silently inheriting whatever the trip's base_currency happens
-- to be at insert time — that implicit inheritance is the exact bug this migration fixes.
