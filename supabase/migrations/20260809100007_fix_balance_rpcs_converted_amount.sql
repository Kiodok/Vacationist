-- Phase 15: Multi-Currency Expense Support — Step 8: balances sum converted_amount, not amount
--
-- Three places summed raw expenses.amount, which was safe only because every expense in a
-- trip was assumed to share the trip's currency. Now that expenses can carry their own
-- currency, converted_amount (frozen in base currency at write time — 20260809100006) is
-- what balance/settlement math must sum instead. expense_splits.amount_owed already means
-- "base-currency amount" both before and after this phase, so nothing there changes.
--
-- Bodies below are copied verbatim from each function's current live version, with only
-- `e.amount` → `e.converted_amount` changed in the "paid" aggregation. No other logic changes.

----------------------------------------------------------------------
-- 1. get_trip_balances (current version: 20260614000004_settlement_aware_balances.sql)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_trip_balances(p_trip_id UUID)
RETURNS TABLE(user_id UUID, total_paid NUMERIC, total_owed NUMERIC, net_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id
      FROM public.trip_members tm
     WHERE tm.trip_id = p_trip_id
  ),
  paid AS (
    SELECT e.paid_by AS uid, COALESCE(SUM(e.converted_amount), 0) AS total
      FROM public.expenses e
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
     GROUP BY e.paid_by
  ),
  owed AS (
    SELECT es.user_id AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
     GROUP BY es.user_id
  ),
  settled_by_ower AS (
    SELECT es.user_id AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
       AND es.user_id != e.paid_by
       AND es.status = 'settled'
     GROUP BY es.user_id
  ),
  settled_to_payer AS (
    SELECT e.paid_by AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
       AND es.user_id != e.paid_by
       AND es.status = 'settled'
     GROUP BY e.paid_by
  )
  SELECT
    m.user_id,
    ROUND(COALESCE(p.total, 0), 2)::NUMERIC AS total_paid,
    ROUND(COALESCE(o.total, 0), 2)::NUMERIC AS total_owed,
    CASE
      WHEN ABS(
        COALESCE(p.total, 0) + COALESCE(sbo.total, 0)
        - COALESCE(o.total, 0) - COALESCE(stp.total, 0)
      ) < 0.01 THEN 0::NUMERIC
      ELSE ROUND(
        COALESCE(p.total, 0) + COALESCE(sbo.total, 0)
        - COALESCE(o.total, 0) - COALESCE(stp.total, 0)
      , 2)::NUMERIC
    END AS net_balance
  FROM members m
  LEFT JOIN paid p ON p.uid = m.user_id
  LEFT JOIN owed o ON o.uid = m.user_id
  LEFT JOIN settled_by_ower sbo ON sbo.uid = m.user_id
  LEFT JOIN settled_to_payer stp ON stp.uid = m.user_id
  ORDER BY net_balance DESC;
END;
$$;

----------------------------------------------------------------------
-- 2. settle_all_expenses (current version: 20260613110000_fix_settle_all_snapshot.sql)
--    Only the pre-settle balance snapshot's "paid" CTE changes (e.amount -> e.converted_amount).
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.settle_all_expenses(p_trip_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller         UUID          := auth.uid();
  v_trip_title     TEXT;
  v_caller_name    TEXT;
  v_currency       TEXT;
  v_creditor_ids   UUID[]        := '{}';
  v_creditor_amts  NUMERIC[]     := '{}';
  v_debtor_ids     UUID[]        := '{}';
  v_debtor_amts    NUMERIC[]     := '{}';
  v_ci             INT           := 1;
  v_di             INT           := 1;
  v_transfer       NUMERIC;
  v_rounded        NUMERIC;
  v_user_names     JSONB         := '{}'::jsonb;
  v_settlements    JSONB         := '[]'::jsonb;
  v_settle_total   NUMERIC(10,2) := 0;
  v_split          RECORD;
  v_count          INT           := 0;
  v_split_ids      UUID[]        := '{}';
  v_members_snap   JSONB;
  v_snapshot       JSONB;
  v_receipt_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  SELECT title, base_currency INTO v_trip_title, v_currency
    FROM public.trips WHERE id = p_trip_id;

  SELECT name INTO v_caller_name
    FROM public.users WHERE id = v_caller;

  SELECT COALESCE(jsonb_object_agg(u.id::text, COALESCE(u.name, '?')), '{}'::jsonb)
    INTO v_user_names
    FROM public.trip_members tm
    JOIN public.users u ON u.id = tm.user_id
   WHERE tm.trip_id = p_trip_id;

  SELECT
    array_agg(user_id            ORDER BY net_bal DESC) FILTER (WHERE net_bal > 0),
    array_agg(ROUND(net_bal, 2)  ORDER BY net_bal DESC) FILTER (WHERE net_bal > 0),
    array_agg(user_id            ORDER BY net_bal ASC)  FILTER (WHERE net_bal < 0),
    array_agg(ROUND(ABS(net_bal), 2) ORDER BY net_bal ASC)  FILTER (WHERE net_bal < 0)
  INTO v_creditor_ids, v_creditor_amts, v_debtor_ids, v_debtor_amts
  FROM (
    WITH
    paid AS (
      SELECT e.paid_by AS uid, COALESCE(SUM(e.converted_amount), 0) AS total
        FROM public.expenses e
       WHERE e.trip_id = p_trip_id AND e.archived_at IS NULL
       GROUP BY e.paid_by
    ),
    owed AS (
      SELECT es.user_id AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
        FROM public.expense_splits es
        JOIN public.expenses e ON e.id = es.expense_id
       WHERE e.trip_id = p_trip_id AND e.archived_at IS NULL
       GROUP BY es.user_id
    ),
    sbo AS (
      SELECT es.user_id AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
        FROM public.expense_splits es
        JOIN public.expenses e ON e.id = es.expense_id
       WHERE e.trip_id = p_trip_id AND e.archived_at IS NULL
         AND es.user_id != e.paid_by AND es.status = 'settled'
       GROUP BY es.user_id
    ),
    stp AS (
      SELECT e.paid_by AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
        FROM public.expense_splits es
        JOIN public.expenses e ON e.id = es.expense_id
       WHERE e.trip_id = p_trip_id AND e.archived_at IS NULL
         AND es.user_id != e.paid_by AND es.status = 'settled'
       GROUP BY e.paid_by
    )
    SELECT
      m.user_id,
      CASE
        WHEN ABS(
          COALESCE(p.total, 0) + COALESCE(sbo.total, 0)
          - COALESCE(o.total, 0) - COALESCE(stp.total, 0)
        ) < 0.01 THEN 0::NUMERIC
        ELSE ROUND(
          COALESCE(p.total, 0) + COALESCE(sbo.total, 0)
          - COALESCE(o.total, 0) - COALESCE(stp.total, 0)
        , 2)::NUMERIC
      END AS net_bal
    FROM public.trip_members m
    LEFT JOIN paid p   ON p.uid = m.user_id
    LEFT JOIN owed o   ON o.uid = m.user_id
    LEFT JOIN sbo      ON sbo.uid = m.user_id
    LEFT JOIN stp      ON stp.uid = m.user_id
    WHERE m.trip_id = p_trip_id
  ) nb;

  WHILE v_ci <= COALESCE(array_length(v_creditor_ids, 1), 0)
    AND v_di <= COALESCE(array_length(v_debtor_ids, 1), 0)
  LOOP
    v_transfer := LEAST(v_creditor_amts[v_ci], v_debtor_amts[v_di]);
    v_rounded  := ROUND(v_transfer, 2);

    IF v_rounded > 0 THEN
      v_settlements := v_settlements || jsonb_build_object(
        'from_user_id',   v_debtor_ids[v_di],
        'from_user_name', COALESCE(v_user_names->>(v_debtor_ids[v_di]::text), '?'),
        'to_user_id',     v_creditor_ids[v_ci],
        'to_user_name',   COALESCE(v_user_names->>(v_creditor_ids[v_ci]::text), '?'),
        'amount',         v_rounded
      );
      v_settle_total := v_settle_total + v_rounded;
    END IF;

    v_creditor_amts[v_ci] := v_creditor_amts[v_ci] - v_transfer;
    v_debtor_amts[v_di]   := v_debtor_amts[v_di]   - v_transfer;

    IF v_creditor_amts[v_ci] < 0.01 THEN v_ci := v_ci + 1; END IF;
    IF v_debtor_amts[v_di]   < 0.01 THEN v_di := v_di + 1; END IF;
  END LOOP;

  FOR v_split IN
    SELECT es.id AS split_id
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
     WHERE e.trip_id      = p_trip_id
       AND e.archived_at  IS NULL
       AND es.user_id     != e.paid_by
       AND es.status      = 'open'
       AND es.covered_by  IS NULL
       AND e.split_method != 'cover'
     ORDER BY e.created_at
  LOOP
    UPDATE public.expense_splits SET status = 'settled' WHERE id = v_split.split_id;
    v_split_ids := v_split_ids || v_split.split_id;
    v_count     := v_count + 1;
  END LOOP;

  UPDATE public.expense_splits es2
     SET status = 'settled'
    FROM public.expenses e2
   WHERE es2.expense_id = e2.id
     AND e2.split_method = 'cover'
     AND e2.archived_at IS NULL
     AND e2.trip_id = p_trip_id
     AND es2.status = 'open'
     AND es2.id = ANY(
       SELECT es3.id
         FROM public.expense_splits es3
         JOIN public.expenses e3 ON e3.id = es3.expense_id
        WHERE e3.trip_id = p_trip_id
          AND e3.split_method = 'cover'
          AND e3.archived_at IS NULL
          AND es3.status = 'open'
          AND EXISTS (
            SELECT 1
              FROM public.expense_splits settled_s
              JOIN public.expenses settled_e ON settled_e.id = settled_s.expense_id
             WHERE settled_s.id = ANY(v_split_ids)
               AND settled_s.user_id = e3.paid_by
               AND settled_e.paid_by = es3.user_id
          )
     );

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No open splits to settle';
  END IF;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('user_id', tm.user_id, 'name', COALESCE(u.name, '?'))),
    '[]'::jsonb
  )
    INTO v_members_snap
    FROM public.trip_members tm
    JOIN public.users u ON u.id = tm.user_id
   WHERE tm.trip_id = p_trip_id;

  v_snapshot := jsonb_build_object(
    'settlements',       v_settlements,
    'members',           v_members_snap,
    'settled_split_ids', to_jsonb(v_split_ids)
  );

  INSERT INTO public.settlement_receipts (trip_id, settled_by, currency, total_amount, splits_count, snapshot)
  VALUES (p_trip_id, v_caller, v_currency, ROUND(v_settle_total, 2), v_count, v_snapshot)
  RETURNING id INTO v_receipt_id;

  PERFORM private.create_trip_notification(
    p_trip_id,
    v_caller,
    'expense_settlement',
    'Expenses settled',
    COALESCE(v_caller_name, 'Someone') || ' settled all expenses in "'
      || COALESCE(v_trip_title, 'your trip') || '".',
    'settlement_receipt',
    v_receipt_id,
    NULL::TEXT,
    v_trip_title,
    v_caller_name
  );

  RETURN v_receipt_id;
END;
$$;

----------------------------------------------------------------------
-- 3. private.create_expense_reminders (current version: 20260615100000)
--    Inline balance check's "paid" join changes e.amount -> e.converted_amount.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.create_expense_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip          RECORD;
  v_days          INT;
  v_title         TEXT;
  v_body          TEXT;
  v_count         INT := 0;
  v_today         DATE := CURRENT_DATE;
  v_has_unsettled BOOLEAN;
BEGIN
  FOR v_trip IN
    SELECT t.id, t.title, t.end_date
    FROM public.trips t
    WHERE t.deleted_at IS NULL
      AND t.end_date < v_today
      AND (v_today - t.end_date) IN (1, 3, 7)
  LOOP
    v_days := v_today - v_trip.end_date;

    SELECT EXISTS (
      SELECT 1
      FROM (
        SELECT
          COALESCE(paid.total, 0)
          - COALESCE(owed.total, 0)
          + COALESCE(settled_for_me.total, 0)
          - COALESCE(settled_by_me.total, 0) AS net
        FROM public.trip_members tm
        LEFT JOIN (
          SELECT e.paid_by AS uid, SUM(e.converted_amount) AS total
          FROM public.expenses e
          WHERE e.trip_id = v_trip.id AND e.archived_at IS NULL
          GROUP BY e.paid_by
        ) paid ON paid.uid = tm.user_id
        LEFT JOIN (
          SELECT es.user_id AS uid, SUM(es.amount_owed) AS total
          FROM public.expense_splits es
          JOIN public.expenses e ON e.id = es.expense_id
          WHERE e.trip_id = v_trip.id AND e.archived_at IS NULL
          GROUP BY es.user_id
        ) owed ON owed.uid = tm.user_id
        LEFT JOIN (
          SELECT es.user_id AS uid, SUM(es.amount_owed) AS total
          FROM public.expense_splits es
          JOIN public.expenses e ON e.id = es.expense_id
          WHERE e.trip_id = v_trip.id
            AND e.archived_at IS NULL
            AND es.user_id != e.paid_by
            AND es.status = 'settled'
          GROUP BY es.user_id
        ) settled_for_me ON settled_for_me.uid = tm.user_id
        LEFT JOIN (
          SELECT e.paid_by AS uid, SUM(es.amount_owed) AS total
          FROM public.expense_splits es
          JOIN public.expenses e ON e.id = es.expense_id
          WHERE e.trip_id = v_trip.id
            AND e.archived_at IS NULL
            AND es.user_id != e.paid_by
            AND es.status = 'settled'
          GROUP BY e.paid_by
        ) settled_by_me ON settled_by_me.uid = tm.user_id
        WHERE tm.trip_id = v_trip.id
      ) balances
      WHERE ABS(balances.net) >= 0.01
    ) INTO v_has_unsettled;

    IF NOT v_has_unsettled THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE trip_id    = v_trip.id
        AND type       = 'reminder'
        AND body LIKE  '%unsettled expenses%'
        AND created_at::date = v_today
      LIMIT 1
    ) THEN
      CONTINUE;
    END IF;

    v_title := 'Unsettled expenses: ' || v_trip.title;
    v_body  := '"' || v_trip.title || '" ended '
               || v_days
               || CASE WHEN v_days = 1 THEN ' day' ELSE ' days' END
               || ' ago and has unsettled expenses. Open the Expenses tab to settle up.';

    PERFORM private.create_trip_notification(
      v_trip.id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      'reminder',
      v_title,
      v_body,
      'expense_reminder',
      v_trip.id,
      NULL::TEXT,
      v_trip.title,
      NULL::TEXT
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
