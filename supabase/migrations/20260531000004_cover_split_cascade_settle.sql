-- Cover splits must settle atomically with their related non-cover splits.
-- Settling cover splits independently causes the balance formula to revert.
--
-- Rules:
--   1. Settling a non-cover split auto-settles any linked cover splits
--      (cover where paid_by = ower AND split consumer = payer).
--   2. Unsettling a non-cover split auto-unsettles those cover splits.
--   3. Settling a cover split directly is blocked (prevents balance reversion).

----------------------------------------------------------------------
-- 1. settle_expense_split
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.settle_expense_split(p_split_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_expense_id  UUID;
  v_split_user  UUID;
  v_paid_by     UUID;
  v_trip_id     UUID;
  v_split_method TEXT;
  v_caller      UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT es.expense_id, es.user_id, e.paid_by, e.trip_id, e.split_method
    INTO v_expense_id, v_split_user, v_paid_by, v_trip_id, v_split_method
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
   WHERE es.id = p_split_id AND e.archived_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Split not found';
  END IF;

  -- Cover splits are managed automatically; block direct settlement
  IF v_split_method = 'cover' THEN
    RAISE EXCEPTION 'Cover splits are settled automatically';
  END IF;

  IF v_caller != v_paid_by
     AND v_caller != v_split_user
     AND NOT private.is_trip_organizer(v_trip_id, v_caller)
  THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Settle the target split
  UPDATE public.expense_splits
     SET status = 'settled'
   WHERE id = p_split_id;

  -- Cascade: settle any open cover splits where
  --   cover.paid_by = this split's ower (covered person)
  --   cover split consumer = this expense's payer (actual cover payer)
  IF v_split_user != v_paid_by THEN
    UPDATE public.expense_splits es
       SET status = 'settled'
      FROM public.expenses e
     WHERE es.expense_id = e.id
       AND e.split_method = 'cover'
       AND e.archived_at IS NULL
       AND e.trip_id = v_trip_id
       AND e.paid_by = v_split_user
       AND es.user_id = v_paid_by
       AND es.status = 'open';
  END IF;
END;
$$;

----------------------------------------------------------------------
-- 2. unsettle_expense_split
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.unsettle_expense_split(p_split_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_expense_id  UUID;
  v_split_user  UUID;
  v_paid_by     UUID;
  v_trip_id     UUID;
  v_split_method TEXT;
  v_caller      UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT es.expense_id, es.user_id, e.paid_by, e.trip_id, e.split_method
    INTO v_expense_id, v_split_user, v_paid_by, v_trip_id, v_split_method
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
   WHERE es.id = p_split_id AND e.archived_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Split not found';
  END IF;

  IF v_split_method = 'cover' THEN
    RAISE EXCEPTION 'Cover splits are managed automatically';
  END IF;

  IF v_caller != v_paid_by
     AND v_caller != v_split_user
     AND NOT private.is_trip_organizer(v_trip_id, v_caller)
  THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Unsettle the target split
  UPDATE public.expense_splits
     SET status = 'open'
   WHERE id = p_split_id;

  -- Cascade: re-open any settled cover splits linked to this debt
  IF v_split_user != v_paid_by THEN
    UPDATE public.expense_splits es
       SET status = 'open'
      FROM public.expenses e
     WHERE es.expense_id = e.id
       AND e.split_method = 'cover'
       AND e.archived_at IS NULL
       AND e.trip_id = v_trip_id
       AND e.paid_by = v_split_user
       AND es.user_id = v_paid_by
       AND es.status = 'settled';
  END IF;
END;
$$;
