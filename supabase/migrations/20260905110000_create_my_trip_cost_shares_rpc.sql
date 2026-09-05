-- v1.34.0 item 2: raw per-trip, per-source cost rows for the new global Analytics tab's "my
-- share" totals. Deliberately "dumb" SQL, same philosophy as get_trip_cost_summary
-- (20260905100000) — the real combination logic (passenger-gated flight shares, even-split
-- shares, year bucketing, currency conversion) lives in the pure, unit-tested
-- computeMyCostShares (packages/utils/src/costSummary.ts).
--
-- Differences from get_trip_cost_summary, both deliberate:
--   - No trip_id parameter — iterates every trip the caller currently belongs to (auth.uid()
--     implicit), so the client can render the whole cross-trip Analytics list in one call
--     instead of N per-trip calls.
--   - transfer_flight rows are NOT pre-aggregated per trip — one row per flight, each carrying
--     `is_my_flight` (whether the caller is an assigned passenger on THAT flight). "My share" of
--     a flight the caller didn't fly on is 0, which only the client-side function can apply
--     correctly per-flight; aggregating flights together here (like get_trip_cost_summary does)
--     would throw away exactly the information needed to do that.
--   - Expenses are represented by the caller's own `expense_splits.amount_owed` sum
--     ('expense_owed_by_me'), not a related_type breakdown — "my share" of expenses is a debt
--     concept (what I owe, matching get_trip_balances' total_owed), not a category concept.

CREATE OR REPLACE FUNCTION public.get_my_trip_cost_shares()
RETURNS TABLE(
  trip_id UUID,
  trip_title TEXT,
  start_date DATE,
  member_count INT,
  source TEXT,
  currency TEXT,
  amount NUMERIC,
  is_my_flight BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH my_trips AS (
    SELECT t.id AS trip_id, t.title AS trip_title, t.start_date, t.base_currency,
           (SELECT COUNT(*)::INT FROM public.trip_members tm WHERE tm.trip_id = t.id) AS member_count
      FROM public.trips t
     WHERE t.deleted_at IS NULL
       AND private.is_trip_member(t.id, v_user_id)
  )
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'accommodation'::TEXT, mt.base_currency, ROUND(SUM(a.price_total), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.accommodations a
    JOIN my_trips mt ON mt.trip_id = a.trip_id
   WHERE a.deleted_at IS NULL
     AND a.status IN ('reserved', 'booked', 'completed')
     AND a.price_total IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, mt.base_currency

  UNION ALL
  -- One row per flight (not aggregated) — is_my_flight needs per-flight passenger membership.
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_flight'::TEXT, f.currency, f.price_per_person, (fp.user_id IS NOT NULL)
    FROM public.transfer_flights f
    JOIN my_trips mt ON mt.trip_id = f.trip_id
    LEFT JOIN public.transfer_flight_passengers fp ON fp.flight_id = f.id AND fp.user_id = v_user_id
   WHERE f.deleted_at IS NULL
     AND f.status IN ('booked', 'completed')
     AND f.price_per_person IS NOT NULL

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.transfer_rentals r
    JOIN my_trips mt ON mt.trip_id = r.trip_id
   WHERE r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, r.currency

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_public_transport'::TEXT, pt.currency, ROUND(SUM(pt.price_total), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.transfer_public_transport pt
    JOIN my_trips mt ON mt.trip_id = pt.trip_id
   WHERE pt.deleted_at IS NULL
     AND pt.price_total IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, pt.currency

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'activity'::TEXT, mt.base_currency, ROUND(SUM(act.cost_estimate), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.activities act
    JOIN my_trips mt ON mt.trip_id = act.trip_id
   WHERE act.deleted_at IS NULL
     AND act.status IN ('reserved', 'completed')
     AND act.cost_estimate IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, mt.base_currency

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'expense_owed_by_me'::TEXT, mt.base_currency, ROUND(SUM(es.amount_owed), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
    JOIN my_trips mt ON mt.trip_id = e.trip_id
   WHERE es.user_id = v_user_id
     AND e.archived_at IS NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, mt.base_currency;
END;
$$;
