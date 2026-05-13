-- Security hardening for expense RPCs:
-- 1. Validate paid_by is a trip member (create + update)
-- 2. Validate all split user_ids are trip members (create + update)
-- 3. Cap maximum split count at 50

----------------------------------------------------------------------
-- 1. Update create_expense_with_splits
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
  p_splits        JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_expense_id  UUID;
  v_split_count INT;
  v_entry       JSONB;
  v_user_id     UUID;
  v_amount      NUMERIC(10,2);
  v_total_shares INT;
  v_sum_check   NUMERIC(10,2);
  v_i           INT;
  v_even_amt    NUMERIC(10,2);
  v_running     NUMERIC(10,2) := 0;
  v_shares_val  INT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  -- Validate payer is a trip member
  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id AND user_id = p_paid_by
  ) THEN
    RAISE EXCEPTION 'Payer must be a trip member';
  END IF;

  v_split_count := jsonb_array_length(p_splits);
  IF v_split_count IS NULL OR v_split_count < 1 THEN
    RAISE EXCEPTION 'At least one split member required';
  END IF;

  IF v_split_count > 50 THEN
    RAISE EXCEPTION 'Too many splits (maximum 50)';
  END IF;

  IF p_split_method NOT IN ('even', 'exact', 'shares') THEN
    RAISE EXCEPTION 'Invalid split method: %', p_split_method;
  END IF;

  -- Validate all split user_ids are trip members
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) e
    LEFT JOIN public.trip_members tm
      ON tm.trip_id = p_trip_id AND tm.user_id = (e->>'user_id')::UUID
    WHERE tm.user_id IS NULL
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

  INSERT INTO public.expenses (trip_id, title, amount, currency, paid_by, related_type, related_id, split_method, created_by)
  VALUES (p_trip_id, p_title, p_amount, p_currency, p_paid_by, p_related_type, p_related_id, p_split_method, v_caller)
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
    END CASE;

    v_running := v_running + v_amount;

    INSERT INTO public.expense_splits (expense_id, user_id, amount_owed, status)
    VALUES (
      v_expense_id,
      v_user_id,
      v_amount,
      CASE WHEN v_user_id = p_paid_by THEN 'settled' ELSE 'open' END
    );
  END LOOP;

  RETURN v_expense_id;
END;
$$;

----------------------------------------------------------------------
-- 2. Update update_expense_with_splits
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_expense_with_splits(
  p_expense_id    UUID,
  p_title         TEXT,
  p_amount        NUMERIC(10,2),
  p_paid_by       UUID,
  p_split_method  TEXT,
  p_splits        JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_trip_id     UUID;
  v_created_by  UUID;
  v_role        TEXT;
  v_split_count INT;
  v_entry       JSONB;
  v_user_id     UUID;
  v_amount      NUMERIC(10,2);
  v_total_shares INT;
  v_sum_check   NUMERIC(10,2);
  v_i           INT;
  v_even_amt    NUMERIC(10,2);
  v_running     NUMERIC(10,2) := 0;
  v_shares_val  INT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, created_by
    INTO v_trip_id, v_created_by
    FROM public.expenses
   WHERE id = p_expense_id AND archived_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  SELECT role INTO v_role
    FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  IF v_role != 'organizer' AND v_created_by != v_caller THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Validate payer is a trip member
  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = v_trip_id AND user_id = p_paid_by
  ) THEN
    RAISE EXCEPTION 'Payer must be a trip member';
  END IF;

  v_split_count := jsonb_array_length(p_splits);
  IF v_split_count IS NULL OR v_split_count < 1 THEN
    RAISE EXCEPTION 'At least one split member required';
  END IF;

  IF v_split_count > 50 THEN
    RAISE EXCEPTION 'Too many splits (maximum 50)';
  END IF;

  IF p_split_method NOT IN ('even', 'exact', 'shares') THEN
    RAISE EXCEPTION 'Invalid split method: %', p_split_method;
  END IF;

  -- Validate all split user_ids are trip members
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) e
    LEFT JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = (e->>'user_id')::UUID
    WHERE tm.user_id IS NULL
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

  UPDATE public.expenses
     SET title = p_title,
         amount = p_amount,
         paid_by = p_paid_by,
         split_method = p_split_method,
         updated_by = v_caller
   WHERE id = p_expense_id;

  DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;

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
    END CASE;

    v_running := v_running + v_amount;

    INSERT INTO public.expense_splits (expense_id, user_id, amount_owed, status)
    VALUES (
      p_expense_id,
      v_user_id,
      v_amount,
      CASE WHEN v_user_id = p_paid_by THEN 'settled' ELSE 'open' END
    );
  END LOOP;
END;
$$;
