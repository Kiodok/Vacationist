-- v1.34.2 follow-up (code-review finding): computeMyCostShares mirrors computeTripCostSummary's
-- category-level precedence — a category with a priced entity of its own suppresses its matching
-- expense bucket. computeTripCostSummary keys that off the *converted entity sum* (`=== 0`), and
-- a flight/PT entry contributes `price_per_person × participant_count` there — so a booked flight
-- with NO passengers or tickets assigned yet contributes 0 and does NOT suppress the transport
-- expense fallback.
--
-- get_my_trip_cost_shares emits one row per flight/PT with just `price_per_person` + `is_mine`,
-- so the client can't tell "booked but nobody assigned" (0 real cost) from "someone is on it"
-- (real cost) — it was treating every booked flight row as transfer-entity presence, diverging
-- from the group card. Fix: only emit a flight / PT row when the entry has at least one
-- participant (assigned passenger OR ticket-holder) — the same "participant" set
-- get_trip_cost_summary already counts. A zero-participant entry then produces no row, exactly
-- like it produces a 0 contribution in the group card.
--
-- Backwards-compatible: a zero-participant flight/PT row was always `is_mine = false` (nobody is
-- on it), so it contributed 0 to every shipped `computeMyCostShares` anyway — dropping it changes
-- no total on the live v1.34.0 / v1.34.1 apps. Non-destructive `CREATE OR REPLACE`, same return
-- shape as 20260905190000.

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
  -- Only flights with >= 1 participant (passenger OR ticket-holder), mirroring the group card's
  -- price_per_person * participant_count (a zero-participant flight contributes 0 there).
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
     AND EXISTS (
       SELECT 1 FROM public.transfer_flight_passengers p WHERE p.flight_id = f.id
       UNION ALL
       SELECT 1 FROM public.transfer_documents d WHERE d.flight_id = f.id
     )

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC, NULL::BOOLEAN, NULL::TEXT
    FROM public.transfer_rentals r
    JOIN my_trips mt ON mt.trip_id = r.trip_id
   WHERE r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, r.currency

  UNION ALL
  -- One row per PT entry, same participant gate as flights.
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
     AND EXISTS (
       SELECT 1 FROM public.transfer_public_transport_passengers p WHERE p.public_transport_id = pt.id
       UNION ALL
       SELECT 1 FROM public.transfer_documents d WHERE d.public_transport_id = pt.id
     )

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
