-- Allow viewing splits for archived expenses (matches the expenses SELECT
-- policy change that now shows archived expenses).

DROP POLICY "expense_splits_select_member" ON public.expense_splits;

CREATE POLICY "expense_splits_select_member"
  ON public.expense_splits FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id
        AND private.is_trip_member(e.trip_id, auth.uid())
    )
  );
