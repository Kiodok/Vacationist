-- Atomic expense creation with splits
--
-- Wraps expense INSERT + splits INSERT in a single function so they
-- succeed or fail together. Prevents orphaned expenses if split
-- insertion fails.

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

  -- Insert expense
  INSERT INTO public.expenses (trip_id, title, amount, currency, paid_by, related_type, related_id, created_by)
  VALUES (p_trip_id, p_title, p_amount, p_currency, p_paid_by, p_related_type, p_related_id, v_caller)
  RETURNING id INTO v_expense_id;

  -- Calculate even split with rounding correction on last member
  v_split_amt := ROUND(p_amount / v_split_count, 2);

  FOR v_i IN 1..v_split_count LOOP
    IF v_i = v_split_count THEN
      v_last_amt := p_amount - v_split_amt * (v_split_count - 1);
    ELSE
      v_last_amt := v_split_amt;
    END IF;

    INSERT INTO public.expense_splits (expense_id, user_id, amount_owed)
    VALUES (v_expense_id, p_split_user_ids[v_i], v_last_amt);
  END LOOP;

  RETURN v_expense_id;
END;
$$;
