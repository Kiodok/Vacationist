-- Phase 5c: Unarchive Expense
-- Allows organizers or expense creators to restore archived expenses

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

  IF v_role <> 'organizer' AND v_created_by <> v_caller THEN
    RAISE EXCEPTION 'Only organizers or the expense creator can unarchive';
  END IF;

  UPDATE public.expenses
     SET archived_at = NULL
   WHERE id = p_expense_id;
END;
$$;
