-- Allow covering an existing expense split in-place.
-- Gary clicks "Cover" on Wife's €10 split in the dinner expense →
--   Wife's split: amount_owed=0, covered_by=Gary, original_amount=10, status='settled'
--   Gary's split: amount_owed += 10 (or INSERT new split if Gary isn't in the expense)
-- Uncover reverses this atomically.

----------------------------------------------------------------------
-- 1. Add columns to expense_splits
----------------------------------------------------------------------

ALTER TABLE public.expense_splits
  ADD COLUMN IF NOT EXISTS covered_by     UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10,2);

----------------------------------------------------------------------
-- 2. cover_split
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cover_split(p_split_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller        UUID := auth.uid();
  v_expense_id    UUID;
  v_split_user    UUID;
  v_paid_by       UUID;
  v_trip_id       UUID;
  v_amount        NUMERIC(10,2);
  v_covering_id   UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT es.expense_id, es.user_id, e.paid_by, e.trip_id, es.amount_owed
    INTO v_expense_id, v_split_user, v_paid_by, v_trip_id, v_amount
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
   WHERE es.id = p_split_id
     AND e.archived_at IS NULL
     AND es.covered_by IS NULL
     AND es.status = 'open';

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Split not found, already covered, or not open';
  END IF;
  IF v_caller = v_split_user THEN
    RAISE EXCEPTION 'Cannot cover your own split';
  END IF;
  IF NOT private.is_trip_member(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  -- Zero out the covered split and mark it as settled (gift — no debt remains)
  UPDATE public.expense_splits
     SET amount_owed = 0,
         covered_by = v_caller,
         original_amount = v_amount,
         status = 'settled'
   WHERE id = p_split_id;

  -- Find covering user's existing split in this expense
  SELECT id INTO v_covering_id
    FROM public.expense_splits
   WHERE expense_id = v_expense_id AND user_id = v_caller;

  IF v_covering_id IS NOT NULL THEN
    -- Increase covering user's existing split (own/settled or open)
    UPDATE public.expense_splits
       SET amount_owed = amount_owed + v_amount
     WHERE id = v_covering_id;
  ELSE
    -- Insert new split for covering user
    INSERT INTO public.expense_splits (expense_id, user_id, amount_owed, status)
    VALUES (v_expense_id, v_caller, v_amount, 'open');
  END IF;
END;
$$;

----------------------------------------------------------------------
-- 3. uncover_split
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.uncover_split(p_split_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller             UUID := auth.uid();
  v_expense_id         UUID;
  v_trip_id            UUID;
  v_covered_by         UUID;
  v_orig_amount        NUMERIC(10,2);
  v_covering_amount    NUMERIC(10,2);
  v_role               TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT es.expense_id, e.trip_id, es.covered_by, es.original_amount
    INTO v_expense_id, v_trip_id, v_covered_by, v_orig_amount
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
   WHERE es.id = p_split_id
     AND e.archived_at IS NULL
     AND es.covered_by IS NOT NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Split not found or not covered';
  END IF;

  SELECT role INTO v_role
    FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;
  IF v_caller != v_covered_by AND v_role != 'organizer' THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Restore the covered split to its original amount and open status
  UPDATE public.expense_splits
     SET amount_owed = v_orig_amount,
         covered_by = NULL,
         original_amount = NULL,
         status = 'open'
   WHERE id = p_split_id;

  -- Reduce or remove the covering user's split
  SELECT amount_owed INTO v_covering_amount
    FROM public.expense_splits
   WHERE expense_id = v_expense_id AND user_id = v_covered_by;

  IF v_covering_amount IS NOT NULL THEN
    IF v_covering_amount - v_orig_amount <= 0 THEN
      -- Split was created solely for this cover: remove it
      DELETE FROM public.expense_splits
       WHERE expense_id = v_expense_id AND user_id = v_covered_by;
    ELSE
      UPDATE public.expense_splits
         SET amount_owed = amount_owed - v_orig_amount
       WHERE expense_id = v_expense_id AND user_id = v_covered_by;
    END IF;
  END IF;
END;
$$;
