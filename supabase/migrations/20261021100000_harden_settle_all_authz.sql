-- Security fix: settle_all_expenses and settle_all_for_pair only checked trip
-- membership, letting any member (including a debtor) mark the whole trip's
-- balances "settled" with zero consent from the actual creditors. Tighten to
-- match settle_expense_split's existing authorization style
-- (20260531000007_remove_cover_cascade.sql).
--
-- settle_all_expenses settles every pair in the trip at once, so "caller is a
-- party" doesn't apply the way it does for a single split -- restrict to
-- trip organizers (private.is_trip_organizer, any organizer, not just the
-- creator -- consistent with settle_expense_split's own fallback branch).
-- The mobile client is updated in the same release to hide the "Settle all"
-- button for non-organizers (apps/mobile/app/trip/[id]/expenses.tsx).
--
-- settle_all_for_pair is scoped to one debtor/creditor pair, so it can use
-- the exact settle_expense_split pattern: caller must be the debtor, the
-- creditor, or an organizer. (Currently unreachable from the app UI -- no
-- packages/api wrapper exists -- but kept per the existing decision recorded
-- in engineering/supabase.md to not remove it; hardened instead.)
--
-- Both bodies are copied verbatim from their current latest definitions
-- (settle_all_expenses: 20260809100007_fix_balance_rpcs_converted_amount.sql;
-- settle_all_for_pair: 20260531000006_settle_all_for_pair.sql) with only the
-- authorization block changed. Argument lists and return types are
-- unchanged, so this is a true in-place CREATE OR REPLACE -- no overload
-- trap (see the migration-create-or-replace-overload-trap skill).

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

  IF NOT private.is_trip_organizer(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Permission denied';
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

CREATE OR REPLACE FUNCTION public.settle_all_for_pair(
  p_trip_id  UUID,
  p_debtor   UUID,
  p_creditor UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_split  RECORD;
  v_count  INT := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller != p_debtor
     AND v_caller != p_creditor
     AND NOT private.is_trip_organizer(p_trip_id, v_caller)
  THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  FOR v_split IN
    SELECT es.id AS split_id
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
       AND e.paid_by = p_creditor
       AND es.user_id = p_debtor
       AND es.status = 'open'
       AND es.covered_by IS NULL
       AND e.split_method != 'cover'
     ORDER BY e.created_at
  LOOP
    UPDATE public.expense_splits
       SET status = 'settled'
     WHERE id = v_split.split_id;

    -- Cascade: settle linked cover-expense splits
    UPDATE public.expense_splits es2
       SET status = 'settled'
      FROM public.expenses e2
     WHERE es2.expense_id = e2.id
       AND e2.split_method = 'cover'
       AND e2.archived_at IS NULL
       AND e2.trip_id = p_trip_id
       AND e2.paid_by = p_debtor
       AND es2.user_id = p_creditor
       AND es2.status = 'open';

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
