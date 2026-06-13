-- Migration: Global "Settle All" with immutable transaction receipts
--
-- 1. Create settlement_receipts table (immutable via RLS)
-- 2. Extend notifications_type_check to include 'expense_settlement'
-- 3. Create settle_all_expenses RPC (settles all open splits, creates receipt, notifies members)

----------------------------------------------------------------------
-- 1. SETTLEMENT_RECEIPTS TABLE
----------------------------------------------------------------------

CREATE TABLE public.settlement_receipts (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID          NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  settled_by   UUID          NOT NULL REFERENCES public.users(id),
  currency     TEXT          NOT NULL CHECK (currency IN ('EUR', 'CHF', 'USD')),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  splits_count INTEGER       NOT NULL CHECK (splits_count > 0),
  -- Frozen snapshot: { settlements: [{from_user_id, from_user_name, to_user_id, to_user_name, amount}],
  --                    members: [{user_id, name}], settled_split_ids: [uuid...] }
  snapshot     JSONB         NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlement_receipts_trip_id
  ON public.settlement_receipts (trip_id, created_at DESC);

----------------------------------------------------------------------
-- RLS: immutable — only the RPC (SECURITY DEFINER) can INSERT;
--      nobody can UPDATE or DELETE.
----------------------------------------------------------------------

ALTER TABLE public.settlement_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlement_receipts_select_member"
  ON public.settlement_receipts FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "settlement_receipts_deny_direct_insert"
  ON public.settlement_receipts FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "settlement_receipts_deny_update"
  ON public.settlement_receipts FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "settlement_receipts_deny_delete"
  ON public.settlement_receipts FOR DELETE TO authenticated
  USING (false);

----------------------------------------------------------------------
-- Realtime publication
----------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.settlement_receipts;

----------------------------------------------------------------------
-- 2. EXTEND notifications_type_check
----------------------------------------------------------------------

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'new_activity',
    'vote_update',
    'expense_change',
    'new_member',
    'schedule_change',
    'reminder',
    'vote_finalized',
    'document_access_request',
    'lost_found',
    'shared_packing',
    'activity_note',
    'expense_settlement'
  ));

----------------------------------------------------------------------
-- 3. settle_all_expenses RPC
--
-- Settles ALL open expense splits across ALL debtor→creditor pairs
-- in a single atomic transaction, creates an immutable receipt, and
-- notifies every other trip member.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.settle_all_expenses(p_trip_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller       UUID          := auth.uid();
  v_trip_title   TEXT;
  v_caller_name  TEXT;
  v_currency     TEXT;
  v_split        RECORD;
  v_count        INT           := 0;
  v_split_ids    UUID[]        := '{}';
  v_total        NUMERIC(10,2) := 0;
  v_settlements  JSONB;
  v_members_snap JSONB;
  v_snapshot     JSONB;
  v_receipt_id   UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  -- Fetch trip metadata for notification and snapshot
  SELECT title, base_currency INTO v_trip_title, v_currency
    FROM public.trips WHERE id = p_trip_id;

  SELECT name INTO v_caller_name
    FROM public.users WHERE id = v_caller;

  -- Settle all open non-cover splits across every debtor→creditor pair
  FOR v_split IN
    SELECT es.id AS split_id, es.amount_owed
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
    UPDATE public.expense_splits
       SET status = 'settled'
     WHERE id = v_split.split_id;

    v_split_ids := v_split_ids || v_split.split_id;
    v_total     := v_total + v_split.amount_owed;
    v_count     := v_count + 1;
  END LOOP;

  -- Cascade: settle cover-expense splits whose debtor has now settled
  -- (mirrors the cascade logic in settle_all_for_pair)
  UPDATE public.expense_splits es2
     SET status = 'settled'
    FROM public.expenses e2
   WHERE es2.expense_id = e2.id
     AND e2.split_method = 'cover'
     AND e2.archived_at IS NULL
     AND e2.trip_id = p_trip_id
     AND es2.status = 'open'
     AND es2.id = ANY(
       -- cover splits belonging to pairs we just settled
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

  -- Build settlements snapshot aggregated by debtor→creditor pair
  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY (row_to_json(s)->>'amount')::numeric DESC), '[]'::jsonb)
    INTO v_settlements
    FROM (
      SELECT
        es.user_id                   AS from_user_id,
        COALESCE(u_from.name, '?')   AS from_user_name,
        e.paid_by                    AS to_user_id,
        COALESCE(u_to.name, '?')     AS to_user_name,
        ROUND(SUM(es.amount_owed), 2) AS amount
      FROM public.expense_splits es
      JOIN public.expenses e     ON e.id    = es.expense_id
      JOIN public.users    u_from ON u_from.id = es.user_id
      JOIN public.users    u_to   ON u_to.id   = e.paid_by
     WHERE es.id = ANY(v_split_ids)
     GROUP BY es.user_id, u_from.name, e.paid_by, u_to.name
    ) s;

  -- Build members snapshot (frozen names)
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

  -- Insert immutable receipt (bypasses the deny INSERT RLS via SECURITY DEFINER)
  INSERT INTO public.settlement_receipts (trip_id, settled_by, currency, total_amount, splits_count, snapshot)
  VALUES (p_trip_id, v_caller, v_currency, ROUND(v_total, 2), v_count, v_snapshot)
  RETURNING id INTO v_receipt_id;

  -- Notify all other trip members
  PERFORM private.create_trip_notification(
    p_trip_id,
    v_caller,
    'expense_settlement',
    'Expenses settled',
    COALESCE(v_caller_name, 'Someone') || ' settled all expenses in "'
      || COALESCE(v_trip_title, 'your trip') || '".',
    'settlement_receipt',
    v_receipt_id,
    NULL,
    v_trip_title,
    v_caller_name
  );

  RETURN v_receipt_id;
END;
$$;
