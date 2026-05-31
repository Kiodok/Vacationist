-- Settle all open splits for a debtor→creditor pair in one call.
-- Used by the "Settle all" button in the Simplified Settlements view.
-- Includes the same cover-split cascade as settle_expense_split.

CREATE OR REPLACE FUNCTION public.settle_all_for_pair(
  p_trip_id  UUID,
  p_debtor   UUID,
  p_creditor UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_split  RECORD;
  v_count  INT := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  FOR v_split IN
    SELECT es.id AS split_id
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
       AND e.paid_by = p_creditor
       AND es.user_id = p_debtor
       AND es.status = 'open'
       AND es.covered_by IS NULL
       AND e.split_method != 'cover'
     ORDER BY e.created_at
  LOOP
    UPDATE public.expense_splits
       SET status = 'settled'
     WHERE id = v_split.split_id;

    -- Cascade: settle linked cover-expense splits
    UPDATE public.expense_splits es2
       SET status = 'settled'
      FROM public.expenses e2
     WHERE es2.expense_id = e2.id
       AND e2.split_method = 'cover'
       AND e2.archived_at IS NULL
       AND e2.trip_id = p_trip_id
       AND e2.paid_by = p_debtor
       AND es2.user_id = p_creditor
       AND es2.status = 'open';

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
