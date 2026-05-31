-- Remove the cover-split cascade from settle/unsettle.
-- The cascade matched by pair (any cover between the same two people),
-- not by specific expense, making it unreliable when multiple covers exist.
-- Cover splits are now settled manually (or via "Settle all").

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
  v_caller      UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT es.expense_id, es.user_id, e.paid_by, e.trip_id
    INTO v_expense_id, v_split_user, v_paid_by, v_trip_id
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
   WHERE es.id = p_split_id AND e.archived_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Split not found';
  END IF;

  IF v_caller != v_paid_by
     AND v_caller != v_split_user
     AND NOT private.is_trip_organizer(v_trip_id, v_caller)
  THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.expense_splits
     SET status = 'settled'
   WHERE id = p_split_id;
END;
$$;

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
  v_caller      UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT es.expense_id, es.user_id, e.paid_by, e.trip_id
    INTO v_expense_id, v_split_user, v_paid_by, v_trip_id
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
   WHERE es.id = p_split_id AND e.archived_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Split not found';
  END IF;

  IF v_caller != v_paid_by
     AND v_caller != v_split_user
     AND NOT private.is_trip_organizer(v_trip_id, v_caller)
  THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.expense_splits
     SET status = 'open'
   WHERE id = p_split_id;
END;
$$;
