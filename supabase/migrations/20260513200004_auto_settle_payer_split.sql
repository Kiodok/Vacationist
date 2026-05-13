-- The payer's own split should be auto-settled on creation (they already paid).
-- Also: if every split member is the payer, mark the expense settled immediately.

-- 1. Update create_expense_with_splits to auto-settle the payer's split
CREATE OR REPLACE FUNCTION public.create_expense_with_splits(
  p_trip_id       UUID,
  p_title         TEXT,
  p_amount        NUMERIC(10,2),
  p_currency      TEXT,
  p_paid_by       UUID,
  p_related_type  TEXT,
  p_related_id    UUID,
  p_split_user_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_expense_id  UUID;
  v_split_count INT;
  v_split_amt   NUMERIC(10,2);
  v_last_amt    NUMERIC(10,2);
  v_all_payer   BOOLEAN := TRUE;
  v_i           INT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  v_split_count := array_length(p_split_user_ids, 1);
  IF v_split_count IS NULL OR v_split_count < 1 THEN
    RAISE EXCEPTION 'At least one split member required';
  END IF;

  INSERT INTO public.expenses (trip_id, title, amount, currency, paid_by, related_type, related_id, created_by)
  VALUES (p_trip_id, p_title, p_amount, p_currency, p_paid_by, p_related_type, p_related_id, v_caller)
  RETURNING id INTO v_expense_id;

  v_split_amt := ROUND(p_amount / v_split_count, 2);

  FOR v_i IN 1..v_split_count LOOP
    IF v_i = v_split_count THEN
      v_last_amt := p_amount - v_split_amt * (v_split_count - 1);
    ELSE
      v_last_amt := v_split_amt;
    END IF;

    INSERT INTO public.expense_splits (expense_id, user_id, amount_owed, status)
    VALUES (
      v_expense_id,
      p_split_user_ids[v_i],
      v_last_amt,
      CASE WHEN p_split_user_ids[v_i] = p_paid_by THEN 'settled' ELSE 'open' END
    );

    IF p_split_user_ids[v_i] != p_paid_by THEN
      v_all_payer := FALSE;
    END IF;
  END LOOP;

  IF v_all_payer THEN
    UPDATE public.expenses SET settled_at = NOW() WHERE id = v_expense_id;
  END IF;

  RETURN v_expense_id;
END;
$$;

-- 2. Backfill: settle all existing payer splits
UPDATE public.expense_splits es
   SET status = 'settled'
  FROM public.expenses e
 WHERE es.expense_id = e.id
   AND es.user_id = e.paid_by
   AND es.status = 'open';

-- 3. Backfill: mark expenses as settled where all splits are now settled
UPDATE public.expenses e
   SET settled_at = NOW()
 WHERE e.settled_at IS NULL
   AND e.archived_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.expense_splits es
      WHERE es.expense_id = e.id AND es.status = 'open'
   )
   AND EXISTS (
     SELECT 1 FROM public.expense_splits es
      WHERE es.expense_id = e.id
   );
