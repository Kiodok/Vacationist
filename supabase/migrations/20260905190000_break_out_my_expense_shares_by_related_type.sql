-- v1.34.2: the global Analytics tab's "my share" figure (computeMyCostShares in
-- @vacationist/utils) double-counted whenever a priced entity (accommodation / rental /
-- activity / flight / PT) ALSO had a matching categorized expense: it added BOTH my even-split
-- of the entity price AND my expense-split debt for the same money. The Trip Overview group
-- card (get_trip_cost_summary + computeTripCostSummary) already resolves this with
-- category-level precedence ("an entity-priced category's own price wins; the matching expense
-- bucket fills in only when nothing is priced at the entity level yet"). computeMyCostShares
-- now applies the same rule — but to do that it needs my expense debt broken out per category,
-- not collapsed into one lump.
--
-- Change: get_my_trip_cost_shares gains a `related_type` OUT column, and the
-- `expense_owed_by_me` branch is grouped by `expenses.related_type` (one row per (trip,
-- related_type) instead of one row per trip). `related_type` is NULL for every other source.
--
-- Backwards-compatible on purpose: `source` stays 'expense_owed_by_me' and the amounts still
-- sum to exactly the old per-trip total, so the live v1.34.1 app — which ignores the new
-- column and does `expenseOwed += amount` over every 'expense_owed_by_me' row — is unaffected
-- when this is pushed ahead of the v1.34.2 build. The new client keys off `related_type`.
--
-- DROP + recreate (not CREATE OR REPLACE): adding an OUT column changes the return type, which
-- Postgres refuses to do in place. No DB object depends on this function (PostgREST RPC only).

DROP FUNCTION IF EXISTS public.get_my_trip_cost_shares();

CREATE OR REPLACE FUNCTION public.get_my_trip_cost_shares()
RETURNS TABLE(
  trip_id UUID,
  trip_title TEXT,
  start_date DATE,
  member_count INT,
  source TEXT,
  currency TEXT,
  amount NUMERIC,
  is_mine BOOLEAN,
  related_type TEXT
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
         'accommodation'::TEXT, a.currency, ROUND(SUM(a.price_total), 2)::NUMERIC, NULL::BOOLEAN, NULL::TEXT
    FROM public.accommodations a
    JOIN my_trips mt ON mt.trip_id = a.trip_id
   WHERE a.deleted_at IS NULL
     AND a.status IN ('reserved', 'booked', 'completed')
     AND a.price_total IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, a.currency

  UNION ALL
  -- One row per flight (not aggregated) — is_mine needs per-flight passenger/ticket membership.
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_flight'::TEXT, f.currency, f.price_per_person,
         (fp.user_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM public.transfer_documents td
             WHERE td.flight_id = f.id AND td.user_id = v_user_id)), NULL::TEXT
    FROM public.transfer_flights f
    JOIN my_trips mt ON mt.trip_id = f.trip_id
    LEFT JOIN public.transfer_flight_passengers fp ON fp.flight_id = f.id AND fp.user_id = v_user_id
   WHERE f.deleted_at IS NULL
     AND f.status IN ('booked', 'completed')
     AND f.price_per_person IS NOT NULL

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC, NULL::BOOLEAN, NULL::TEXT
    FROM public.transfer_rentals r
    JOIN my_trips mt ON mt.trip_id = r.trip_id
   WHERE r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, r.currency

  UNION ALL
  -- One row per PT entry (not aggregated) — is_mine needs per-entry passenger/ticket membership.
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_public_transport'::TEXT, pt.currency, pt.price_total,
         (ptp.user_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM public.transfer_documents td
             WHERE td.public_transport_id = pt.id AND td.user_id = v_user_id)), NULL::TEXT
    FROM public.transfer_public_transport pt
    JOIN my_trips mt ON mt.trip_id = pt.trip_id
    LEFT JOIN public.transfer_public_transport_passengers ptp
           ON ptp.public_transport_id = pt.id AND ptp.user_id = v_user_id
   WHERE pt.deleted_at IS NULL
     AND pt.price_total IS NOT NULL

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'activity'::TEXT, mt.base_currency, ROUND(SUM(act.cost_estimate), 2)::NUMERIC, NULL::BOOLEAN, NULL::TEXT
    FROM public.activities act
    JOIN my_trips mt ON mt.trip_id = act.trip_id
   WHERE act.deleted_at IS NULL
     AND act.status IN ('reserved', 'completed')
     AND act.cost_estimate IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, mt.base_currency

  UNION ALL
  -- Now grouped by related_type too: one row per (trip, related_type). Still source
  -- 'expense_owed_by_me'; the amounts sum to the same per-trip total as before.
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'expense_owed_by_me'::TEXT, mt.base_currency, ROUND(SUM(es.amount_owed), 2)::NUMERIC,
         NULL::BOOLEAN, e.related_type
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
    JOIN my_trips mt ON mt.trip_id = e.trip_id
   WHERE es.user_id = v_user_id
     AND e.archived_at IS NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, mt.base_currency, e.related_type;
END;
$$;
