-- v1.39.2 task 4: stop double-counting a booked accommodation/flight/rental/public-transport
-- entry that ALSO has a dedicated expense recorded for it.
--
-- Root cause: the group cost card (get_trip_cost_summary) and the per-person Analytics share
-- (get_my_trip_cost_shares) both count a booked entity's own price AND any expense whose
-- `related_type` matches its category (expense_accommodation / expense_transport). The client-side
-- precedence in packages/utils/src/costSummary.ts only suppresses the expense bucket when the
-- entity's category-level sum is > 0 — but real users recording "I made a separate expense for
-- this booking so the group can split it" very often pick a different/generic category for that
-- expense (confirmed in production data), so the heuristic never fires and both sides are summed.
--
-- Fix: `expenses.related_id` already exists and is already wired end-to-end
-- (CreateExpenseSheet -> packages/api/src/expenses.ts -> create_expense_with_splits ->
-- expenses.related_id) but no UI has ever populated it. Going forward, the "Book"
-- confirmation flow (accommodations, flights) and the create/edit save flow (rentals, public
-- transport — no Book/status step) can offer to prefill a new expense with
-- `related_id = <entity>.id`. Once that link exists, these two RPCs exclude that SPECIFIC
-- entity row from the group/entity sum — a precise per-row exclusion, not a category-level
-- heuristic — and simply let the expense side count it instead (the expense_* buckets stay
-- unconditional sums, as they already are). This is self-healing: archiving, deleting or
-- re-categorizing the linked expense makes the entity count again automatically, no extra code.
--
-- `related_id` with no matching live expense (the default for every row that exists today) means
-- "count the entity directly" — unchanged from today's behavior.
--
-- Scope: accommodations, transfer_flights, transfer_rentals, transfer_public_transport only.
-- `activity` is NOT touched here — it keeps the existing category-level heuristic (out of scope,
-- see engineering/software_engineering_guide.md §11 for the follow-up note).
--
-- Both function bodies are the live 20260905170000 (get_trip_cost_summary) /
-- 20260905200000 (get_my_trip_cost_shares) versions, verbatim, plus one
-- `AND NOT EXISTS (...)` per entity-sourced branch. Same return shape, same signature —
-- CREATE OR REPLACE, no DROP needed.

----------------------------------------------------------------------
-- get_trip_cost_summary
----------------------------------------------------------------------

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
  SELECT 'accommodation'::TEXT, a.currency, ROUND(SUM(a.price_total), 2)::NUMERIC
    FROM public.accommodations a
   WHERE a.trip_id = p_trip_id
     AND a.deleted_at IS NULL
     AND a.status IN ('reserved', 'booked', 'completed')
     AND a.price_total IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2 WHERE e2.related_id = a.id AND e2.archived_at IS NULL
     )
   GROUP BY a.currency

  UNION ALL
  SELECT 'transfer_flight'::TEXT, f.currency,
         ROUND(SUM(f.price_per_person * pc.participant_count), 2)::NUMERIC
    FROM public.transfer_flights f
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS participant_count FROM (
        SELECT user_id FROM public.transfer_flight_passengers WHERE flight_id = f.id
        UNION
        SELECT user_id FROM public.transfer_documents WHERE flight_id = f.id
      ) x
    ) pc ON TRUE
   WHERE f.trip_id = p_trip_id
     AND f.deleted_at IS NULL
     AND f.status IN ('booked', 'completed')
     AND f.price_per_person IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2 WHERE e2.related_id = f.id AND e2.archived_at IS NULL
     )
   GROUP BY f.currency

  UNION ALL
  SELECT 'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC
    FROM public.transfer_rentals r
   WHERE r.trip_id = p_trip_id
     AND r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2 WHERE e2.related_id = r.id AND e2.archived_at IS NULL
     )
   GROUP BY r.currency

  UNION ALL
  SELECT 'transfer_public_transport'::TEXT, pt.currency,
         ROUND(SUM(pt.price_total * ptc.participant_count), 2)::NUMERIC
    FROM public.transfer_public_transport pt
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS participant_count FROM (
        SELECT user_id FROM public.transfer_public_transport_passengers WHERE public_transport_id = pt.id
        UNION
        SELECT user_id FROM public.transfer_documents WHERE public_transport_id = pt.id
      ) x
    ) ptc ON TRUE
   WHERE pt.trip_id = p_trip_id
     AND pt.deleted_at IS NULL
     AND pt.price_total IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2 WHERE e2.related_id = pt.id AND e2.archived_at IS NULL
     )
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

----------------------------------------------------------------------
-- get_my_trip_cost_shares
----------------------------------------------------------------------

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
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2 WHERE e2.related_id = a.id AND e2.archived_at IS NULL
     )
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
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2 WHERE e2.related_id = f.id AND e2.archived_at IS NULL
     )

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC, NULL::BOOLEAN, NULL::TEXT
    FROM public.transfer_rentals r
    JOIN my_trips mt ON mt.trip_id = r.trip_id
   WHERE r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2 WHERE e2.related_id = r.id AND e2.archived_at IS NULL
     )
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
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2 WHERE e2.related_id = pt.id AND e2.archived_at IS NULL
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

----------------------------------------------------------------------
-- Index to keep the new per-row EXISTS lookups cheap.
----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_expenses_related_id
  ON public.expenses (related_id)
  WHERE related_id IS NOT NULL AND archived_at IS NULL;
