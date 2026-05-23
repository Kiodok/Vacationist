-- Security fix: the expense_splits_insert_creator policy allowed direct INSERT,
-- bypassing the trip-member validation enforced in create_expense_with_splits
-- and update_expense_with_splits RPCs. A caller could insert splits with
-- arbitrary user_ids that are not trip members.
--
-- Fix: replace the policy with WITH CHECK (false) so direct INSERT is always
-- denied. All writes must go through the SECURITY DEFINER RPCs which validate
-- every split user_id against trip membership.

DROP POLICY IF EXISTS "expense_splits_insert_creator" ON public.expense_splits;

CREATE POLICY "expense_splits_insert_rpc_only"
  ON public.expense_splits FOR INSERT TO authenticated
  WITH CHECK (false);
