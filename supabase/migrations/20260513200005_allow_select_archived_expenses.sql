-- Allow trip members to view archived expenses so they can be shown
-- in an "Archived" section. Previously the SELECT policy filtered them out.

DROP POLICY "expenses_select_member" ON public.expenses;

CREATE POLICY "expenses_select_member"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    private.is_trip_member(trip_id, auth.uid())
  );
