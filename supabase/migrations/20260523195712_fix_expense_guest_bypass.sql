-- Security fix: guests must not be able to archive or unarchive expenses.
-- Both functions allow any trip member who created the expense to act on it,
-- but guests should have read-only access. Adding an explicit guest block
-- before the creator check closes the bypass.

----------------------------------------------------------------------
-- 1. archive_expense — block guests
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_expense(p_expense_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id    UUID;
  v_created_by UUID;
  v_caller     UUID := auth.uid();
  v_role       TEXT;
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

  IF v_role = 'guest' THEN
    RAISE EXCEPTION 'Guests cannot archive expenses';
  END IF;

  IF v_role = 'organizer' THEN
    NULL;
  ELSIF v_created_by = v_caller THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.expenses
     SET archived_at = NOW()
   WHERE id = p_expense_id;
END;
$$;

----------------------------------------------------------------------
-- 2. unarchive_expense — block guests
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unarchive_expense(p_expense_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id    UUID;
  v_created_by UUID;
  v_caller     UUID := auth.uid();
  v_role       TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, created_by
    INTO v_trip_id, v_created_by
    FROM public.expenses
   WHERE id = p_expense_id AND archived_at IS NOT NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Archived expense not found';
  END IF;

  SELECT role INTO v_role
    FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  IF v_role = 'guest' THEN
    RAISE EXCEPTION 'Guests cannot unarchive expenses';
  END IF;

  IF v_role <> 'organizer' AND v_created_by <> v_caller THEN
    RAISE EXCEPTION 'Only organizers or the expense creator can unarchive';
  END IF;

  UPDATE public.expenses
     SET archived_at = NULL
   WHERE id = p_expense_id;
END;
$$;
