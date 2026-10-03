-- v1.39.2 follow-up (code-review finding, 2026-10-03): trip-scope the related_id exclusion.
--
-- 20261003110000 added `NOT EXISTS (SELECT 1 FROM expenses e2 WHERE e2.related_id = <row>.id
-- AND e2.archived_at IS NULL)` to exclude a booked entity from the cost summary once a live
-- expense links to it — but matched purely on related_id, with no e2.trip_id scoping, and
-- create_expense_with_splits never validated that p_related_id actually belongs to p_trip_id.
--
-- Failure mode: a bug, a stale replayed mutation-queue entry, or a direct RPC call could set an
-- expense's related_id to a UUID belonging to an accommodation/flight/rental/PT row in a
-- DIFFERENT trip the same user also happens to be a member of. That unrelated trip's entity
-- would then be silently excluded from ITS OWN trip's cost summary and per-person Analytics
-- share, even though the linking expense lives in a completely different trip.
--
-- Fix, both sides:
--  1. Read side: every NOT EXISTS in get_trip_cost_summary / get_my_trip_cost_shares now also
--     requires e2.trip_id = <row>.trip_id — an expense can only suppress an entity in its own
--     trip, full stop, regardless of what related_id ends up pointing at.
--  2. Write side (defense in depth): create_expense_with_splits now rejects a p_related_id that
--     doesn't resolve to a row in p_trip_id across the four linkable tables, so the bad data
--     can't be written in the first place. update_expense_with_splits doesn't need the same
--     check — it never accepts p_related_id at all (an expense's link, once set at creation,
--     isn't editable from the edit form).
--
-- All three function bodies are the live versions verbatim (20261003110000 for the two cost
-- RPCs, 20260924120000 for create_expense_with_splits) plus the changes described above. Same
-- signatures throughout — CREATE OR REPLACE, no DROP needed.

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
       SELECT 1 FROM public.expenses e2
        WHERE e2.related_id = a.id AND e2.trip_id = a.trip_id AND e2.archived_at IS NULL
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
       SELECT 1 FROM public.expenses e2
        WHERE e2.related_id = f.id AND e2.trip_id = f.trip_id AND e2.archived_at IS NULL
     )
   GROUP BY f.currency

  UNION ALL
  SELECT 'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC
    FROM public.transfer_rentals r
   WHERE r.trip_id = p_trip_id
     AND r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2
        WHERE e2.related_id = r.id AND e2.trip_id = r.trip_id AND e2.archived_at IS NULL
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
       SELECT 1 FROM public.expenses e2
        WHERE e2.related_id = pt.id AND e2.trip_id = pt.trip_id AND e2.archived_at IS NULL
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
       SELECT 1 FROM public.expenses e2
        WHERE e2.related_id = a.id AND e2.trip_id = a.trip_id AND e2.archived_at IS NULL
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
       SELECT 1 FROM public.expenses e2
        WHERE e2.related_id = f.id AND e2.trip_id = f.trip_id AND e2.archived_at IS NULL
     )

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC, NULL::BOOLEAN, NULL::TEXT
    FROM public.transfer_rentals r
    JOIN my_trips mt ON mt.trip_id = r.trip_id
   WHERE r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.expenses e2
        WHERE e2.related_id = r.id AND e2.trip_id = r.trip_id AND e2.archived_at IS NULL
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
       SELECT 1 FROM public.expenses e2
        WHERE e2.related_id = pt.id AND e2.trip_id = pt.trip_id AND e2.archived_at IS NULL
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
-- create_expense_with_splits — reject a p_related_id outside p_trip_id
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_expense_with_splits(
  p_trip_id       UUID,
  p_title         TEXT,
  p_amount        NUMERIC(10,2),
  p_currency      TEXT,
  p_paid_by       UUID,
  p_related_type  TEXT,
  p_related_id    UUID,
  p_split_method  TEXT,
  p_splits        JSONB,
  p_description   TEXT DEFAULT NULL,
  p_is_business   BOOLEAN DEFAULT FALSE,
  p_tip_amount    NUMERIC(10,2) DEFAULT 0,
  p_id            UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller          UUID := auth.uid();
  v_expense_id      UUID;
  v_split_count     INT;
  v_entry           JSONB;
  v_user_id         UUID;
  v_amount          NUMERIC(10,2);
  v_total_shares    INT;
  v_sum_check       NUMERIC(10,2);
  v_i               INT;
  v_even_amt        NUMERIC(10,2);
  v_running         NUMERIC(10,2) := 0;
  v_shares_val      INT;
  v_base_currency   TEXT;
  v_exchange_rate   NUMERIC(18,8);
  v_rate_base       NUMERIC(18,8);
  v_rate_target     NUMERIC(18,8);
  v_converted_amt   NUMERIC(10,2);
  v_owed_base       NUMERIC(10,2);
  v_tip             NUMERIC(10,2) := COALESCE(p_tip_amount, 0);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  -- Idempotent replay of an offline-queued create. The client mints `p_id` (a real UUID) so the
  -- optimistic row, the queue entry and this insert share one key. If an earlier attempt already landed
  -- (request succeeded, response lost) the same id comes straight back instead of raising a duplicate-key
  -- error that would strand the queued change. Only the caller's own row in the same trip qualifies, so a
  -- guessed/foreign id can never be used to probe another trip's expense.
  IF p_id IS NOT NULL THEN
    SELECT id INTO v_expense_id
      FROM public.expenses
     WHERE id = p_id AND trip_id = p_trip_id AND created_by = v_caller;
    IF v_expense_id IS NOT NULL THEN
      RETURN v_expense_id;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id AND user_id = p_paid_by
  ) THEN
    RAISE EXCEPTION 'Payer must be a trip member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.currency_catalog WHERE code = p_currency AND is_active
  ) THEN
    RAISE EXCEPTION 'Unsupported currency: %', p_currency;
  END IF;

  v_split_count := jsonb_array_length(p_splits);
  IF v_split_count IS NULL OR v_split_count < 1 THEN
    RAISE EXCEPTION 'At least one split member required';
  END IF;

  IF v_split_count > 50 THEN
    RAISE EXCEPTION 'Too many splits (maximum 50)';
  END IF;

  IF p_split_method NOT IN ('even', 'exact', 'shares', 'cover') THEN
    RAISE EXCEPTION 'Invalid split method: %', p_split_method;
  END IF;

  IF p_related_type NOT IN (
    'accommodation', 'activity', 'transport', 'shopping', 'manual',
    'food_drink', 'groceries', 'fuel_parking', 'tickets_entry', 'health', 'souvenirs'
  ) THEN
    RAISE EXCEPTION 'Invalid category: %', p_related_type;
  END IF;

  -- v1.39.2 follow-up: p_related_id must resolve to a row in THIS trip across the four tables
  -- the cost-summary RPCs key their related_id exclusion off of — otherwise a cross-trip id
  -- (bug, stale replay, or a direct RPC call) could silently suppress an unrelated trip's
  -- entity from its own cost analysis (code review 2026-10-03).
  IF p_related_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.accommodations WHERE id = p_related_id AND trip_id = p_trip_id
    UNION ALL
    SELECT 1 FROM public.transfer_flights WHERE id = p_related_id AND trip_id = p_trip_id
    UNION ALL
    SELECT 1 FROM public.transfer_rentals WHERE id = p_related_id AND trip_id = p_trip_id
    UNION ALL
    SELECT 1 FROM public.transfer_public_transport WHERE id = p_related_id AND trip_id = p_trip_id
  ) THEN
    RAISE EXCEPTION 'related_id must reference an entity in this trip';
  END IF;

  IF v_tip < 0 OR v_tip > p_amount THEN
    RAISE EXCEPTION 'Tip must be between 0 and the expense amount';
  END IF;

  -- Every split member must be a real trip member OR the "Deleted User" sentinel (a departed
  -- member's historical share, resubmitted unchanged — see this migration's header comment).
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) e
    LEFT JOIN public.trip_members tm
      ON tm.trip_id = p_trip_id AND tm.user_id = (e->>'user_id')::UUID
    WHERE tm.user_id IS NULL
      AND (e->>'user_id')::UUID != '00000000-0000-0000-0000-000000000000'::UUID
  ) THEN
    RAISE EXCEPTION 'All split members must be trip members';
  END IF;

  IF p_split_method = 'exact' THEN
    SELECT COALESCE(SUM((e->>'amount')::NUMERIC), 0)
      INTO v_sum_check
      FROM jsonb_array_elements(p_splits) e;
    IF ROUND(v_sum_check, 2) != ROUND(p_amount, 2) THEN
      RAISE EXCEPTION 'Split amounts (%) do not sum to expense amount (%)', v_sum_check, p_amount;
    END IF;
  END IF;

  IF p_split_method = 'shares' THEN
    SELECT COALESCE(SUM((e->>'shares')::INT), 0)
      INTO v_total_shares
      FROM jsonb_array_elements(p_splits) e;
    IF v_total_shares <= 0 THEN
      RAISE EXCEPTION 'Total shares must be greater than zero';
    END IF;
  END IF;

  IF p_split_method = 'cover' THEN
    IF v_split_count != 1 THEN
      RAISE EXCEPTION 'Cover method requires exactly one split entry';
    END IF;
    IF (p_splits->0->>'user_id')::UUID = p_paid_by THEN
      RAISE EXCEPTION 'Cannot cover yourself';
    END IF;
  END IF;

  -- ── FX: resolve exchange_rate / converted_amount, frozen at write time ──────
  SELECT base_currency INTO v_base_currency FROM public.trips WHERE id = p_trip_id;

  IF p_currency = v_base_currency THEN
    v_exchange_rate := 1;
  ELSE
    v_rate_base   := private.get_latest_exchange_rate(v_base_currency);
    v_rate_target := private.get_latest_exchange_rate(p_currency);
    IF v_rate_base IS NULL OR v_rate_target IS NULL THEN
      RAISE EXCEPTION 'Exchange rate unavailable for % -> %', p_currency, v_base_currency;
    END IF;
    v_exchange_rate := v_rate_base / v_rate_target;
  END IF;

  v_converted_amt := ROUND(p_amount * v_exchange_rate, 2);

  INSERT INTO public.expenses (id, trip_id, title, description, amount, currency, paid_by, related_type, related_id, split_method, created_by, exchange_rate, converted_amount, is_business, tip_amount)
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    p_trip_id, p_title,
    CASE WHEN p_description = '' THEN NULL ELSE p_description END,
    p_amount, p_currency, p_paid_by, p_related_type, p_related_id, p_split_method, v_caller, v_exchange_rate, v_converted_amt,
    COALESCE(p_is_business, FALSE),
    v_tip
  )
  RETURNING id INTO v_expense_id;

  IF p_split_method = 'even' THEN
    v_even_amt := ROUND(p_amount / v_split_count, 2);
  END IF;

  FOR v_i IN 0..(v_split_count - 1) LOOP
    v_entry := p_splits->v_i;
    v_user_id := (v_entry->>'user_id')::UUID;

    CASE p_split_method
      WHEN 'even' THEN
        IF v_i = v_split_count - 1 THEN
          v_amount := p_amount - v_running;
        ELSE
          v_amount := v_even_amt;
        END IF;
      WHEN 'exact' THEN
        v_amount := ROUND((v_entry->>'amount')::NUMERIC, 2);
      WHEN 'shares' THEN
        v_shares_val := (v_entry->>'shares')::INT;
        IF v_i = v_split_count - 1 THEN
          v_amount := p_amount - v_running;
        ELSE
          v_amount := ROUND(p_amount * v_shares_val / v_total_shares, 2);
        END IF;
      WHEN 'cover' THEN
        v_amount := p_amount;
    END CASE;

    v_running := v_running + v_amount;
    v_owed_base := ROUND(v_amount * v_exchange_rate, 2);

    INSERT INTO public.expense_splits (expense_id, user_id, amount_owed, status, amount_owed_original_currency)
    VALUES (
      v_expense_id,
      v_user_id,
      v_owed_base,
      CASE WHEN v_user_id = p_paid_by THEN 'settled' ELSE 'open' END,
      CASE WHEN p_currency = v_base_currency THEN NULL ELSE v_amount END
    );
  END LOOP;

  -- v1.39.1: make the base-currency splits sum to converted_amount exactly (see header).
  PERFORM private.absorb_split_rounding(v_expense_id, v_converted_amt, p_split_method);

  RETURN v_expense_id;
END;
$$;
