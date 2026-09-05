-- v1.34.0 items 7 & 8: raw per-source, per-currency cost rows for the Trip Overview cost
-- summary card. Deliberately "dumb" SQL — status/soft-delete filtering and per-row grouping
-- only, no cross-source fallback logic and no currency conversion. That combination logic
-- lives in the pure, unit-tested `computeTripCostSummary` (packages/utils/src/costSummary.ts) —
-- this repo has no Docker/pgTAP, so anything worth testing extensively belongs in a plain
-- TypeScript function, not opaque SQL (same reasoning as get_trip_expense_category_totals's
-- sibling client-side arc math). `source` stays granular (not pre-collapsed into the 4 display
-- categories) so the client can implement the entity-price-wins-over-expense-category fallback.
--
-- "Committed" filter per source (matches the Tech Lead's clarification):
--   accommodations              status IN ('reserved','booked','completed')
--   transfer_flights            status IN ('booked','completed'); amount = price_per_person *
--                                passenger count (a flight nobody is assigned to contributes 0)
--   transfer_rentals            always (no status/voting lifecycle on this table)
--   transfer_public_transport   always (no status/voting lifecycle on this table)
--   activities                  status IN ('reserved','completed')
--   expenses                    archived_at IS NULL; one row per related_type bucket, always in
--                               the trip's base_currency (converted_amount is frozen there)

CREATE OR REPLACE FUNCTION public.get_trip_cost_summary(p_trip_id UUID)
RETURNS TABLE(source TEXT, currency TEXT, amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_base_currency TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  SELECT t.base_currency INTO v_base_currency FROM public.trips t WHERE t.id = p_trip_id;

  RETURN QUERY
  SELECT 'accommodation'::TEXT, v_base_currency, ROUND(SUM(a.price_total), 2)::NUMERIC
    FROM public.accommodations a
   WHERE a.trip_id = p_trip_id
     AND a.deleted_at IS NULL
     AND a.status IN ('reserved', 'booked', 'completed')
     AND a.price_total IS NOT NULL
   GROUP BY v_base_currency

  UNION ALL
  SELECT 'transfer_flight'::TEXT, f.currency, ROUND(SUM(f.price_per_person * COALESCE(pc.passenger_count, 0)), 2)::NUMERIC
    FROM public.transfer_flights f
    LEFT JOIN (
      SELECT flight_id, COUNT(*) AS passenger_count
        FROM public.transfer_flight_passengers
       GROUP BY flight_id
    ) pc ON pc.flight_id = f.id
   WHERE f.trip_id = p_trip_id
     AND f.deleted_at IS NULL
     AND f.status IN ('booked', 'completed')
     AND f.price_per_person IS NOT NULL
   GROUP BY f.currency

  UNION ALL
  SELECT 'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC
    FROM public.transfer_rentals r
   WHERE r.trip_id = p_trip_id
     AND r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
   GROUP BY r.currency

  UNION ALL
  SELECT 'transfer_public_transport'::TEXT, pt.currency, ROUND(SUM(pt.price_total), 2)::NUMERIC
    FROM public.transfer_public_transport pt
   WHERE pt.trip_id = p_trip_id
     AND pt.deleted_at IS NULL
     AND pt.price_total IS NOT NULL
   GROUP BY pt.currency

  UNION ALL
  SELECT 'activity'::TEXT, v_base_currency, ROUND(SUM(act.cost_estimate), 2)::NUMERIC
    FROM public.activities act
   WHERE act.trip_id = p_trip_id
     AND act.deleted_at IS NULL
     AND act.status IN ('reserved', 'completed')
     AND act.cost_estimate IS NOT NULL
   GROUP BY v_base_currency

  UNION ALL
  SELECT 'expense_' || e.related_type, v_base_currency, ROUND(SUM(e.converted_amount), 2)::NUMERIC
    FROM public.expenses e
   WHERE e.trip_id = p_trip_id
     AND e.archived_at IS NULL
   GROUP BY e.related_type;
END;
$$;
