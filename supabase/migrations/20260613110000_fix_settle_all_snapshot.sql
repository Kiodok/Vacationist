-- Migration: Fix settle_all_expenses — use simplified settlements in receipt snapshot
--
-- Root cause: the original RPC (20260613100000) stored raw expense_splits grouped by
-- (debtor, creditor) pair, producing N bilateral entries. The Settlements modal shows
-- computeSettlements() output — a greedy min-payment algorithm that collapses circular
-- debts into the fewest possible transfers. The receipt must show the same view.
--
-- Fix:
--   1. Compute net balances inline (mirrors get_trip_balances logic) BEFORE any UPDATEs.
--   2. Run the greedy two-pointer algorithm (exact port of computeSettlements in TS).
--   3. Store the simplified transfer list — not the raw pair aggregates — in the snapshot.
--   4. total_amount is now the sum of the simplified transfers (not the sum of raw splits).
--   5. Cast context_entity NULL explicitly to TEXT to avoid parameter-binding ambiguity.

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
  -- Greedy min-payment algorithm state (mirrors computeSettlements in @vacationist/utils)
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
  -- Split settling
  v_split          RECORD;
  v_count          INT           := 0;
  v_split_ids      UUID[]        := '{}';
  -- Snapshot
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

  -- Frozen user-name map: UUID text key → display name
  SELECT COALESCE(jsonb_object_agg(u.id::text, COALESCE(u.name, '?')), '{}'::jsonb)
    INTO v_user_names
    FROM public.trip_members tm
    JOIN public.users u ON u.id = tm.user_id
   WHERE tm.trip_id = p_trip_id;

  -- ── Step 1: Capture pre-settle net balances ────────────────────────────────
  -- Inline the get_trip_balances formula so we read the outstanding state before
  -- any UPDATEs. Creditors (net > 0) sorted largest-first; debtors (net < 0)
  -- sorted by largest absolute value first — same ordering as computeSettlements.
  SELECT
    array_agg(user_id            ORDER BY net_bal DESC) FILTER (WHERE net_bal > 0),
    array_agg(ROUND(net_bal, 2)  ORDER BY net_bal DESC) FILTER (WHERE net_bal > 0),
    array_agg(user_id            ORDER BY net_bal ASC)  FILTER (WHERE net_bal < 0),
    array_agg(ROUND(ABS(net_bal), 2) ORDER BY net_bal ASC)  FILTER (WHERE net_bal < 0)
  INTO v_creditor_ids, v_creditor_amts, v_debtor_ids, v_debtor_amts
  FROM (
    WITH
    paid AS (
      SELECT e.paid_by AS uid, COALESCE(SUM(e.amount), 0) AS total
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
      -- Amount each debtor has already settled (credit toward their balance)
      SELECT es.user_id AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
        FROM public.expense_splits es
        JOIN public.expenses e ON e.id = es.expense_id
       WHERE e.trip_id = p_trip_id AND e.archived_at IS NULL
         AND es.user_id != e.paid_by AND es.status = 'settled'
       GROUP BY es.user_id
    ),
    stp AS (
      -- Amount each payer has already received back (debit from their balance)
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

  -- ── Step 2: Greedy two-pointer algorithm ───────────────────────────────────
  -- Exact port of computeSettlements() in packages/utils/src/settlements.ts.
  -- isNegligible threshold: < 0.01 (matches the TS implementation).
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

  -- ── Step 3: Settle all open non-cover splits ───────────────────────────────
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

  -- Cascade: settle linked cover-expense splits (mirrors settle_all_for_pair)
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

  -- ── Step 4: Build frozen members snapshot ─────────────────────────────────
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('user_id', tm.user_id, 'name', COALESCE(u.name, '?'))),
    '[]'::jsonb
  )
    INTO v_members_snap
    FROM public.trip_members tm
    JOIN public.users u ON u.id = tm.user_id
   WHERE tm.trip_id = p_trip_id;

  v_snapshot := jsonb_build_object(
    'settlements',       v_settlements,    -- simplified min-payment paths
    'members',           v_members_snap,   -- frozen names
    'settled_split_ids', to_jsonb(v_split_ids)
  );

  -- ── Step 5: Insert immutable receipt ──────────────────────────────────────
  INSERT INTO public.settlement_receipts (trip_id, settled_by, currency, total_amount, splits_count, snapshot)
  VALUES (p_trip_id, v_caller, v_currency, ROUND(v_settle_total, 2), v_count, v_snapshot)
  RETURNING id INTO v_receipt_id;

  -- ── Step 6: Notify all other trip members ─────────────────────────────────
  PERFORM private.create_trip_notification(
    p_trip_id,
    v_caller,
    'expense_settlement',
    'Expenses settled',
    COALESCE(v_caller_name, 'Someone') || ' settled all expenses in "'
      || COALESCE(v_trip_title, 'your trip') || '".',
    'settlement_receipt',
    v_receipt_id,
    NULL::TEXT,       -- context_entity: not applicable for settlement
    v_trip_title,
    v_caller_name
  );

  RETURN v_receipt_id;
END;
$$;
