-- Expense schema hardening: remove denormalized columns, add audit metadata.
--
-- 1a. Remove shares from expense_splits (input mechanics only, not business truth)
-- 1b. Remove settled_at from expenses + auto-settle trigger (derived from splits)
-- 1c. Add updated_by audit column to expenses

----------------------------------------------------------------------
-- 1a. DROP shares column from expense_splits
----------------------------------------------------------------------

ALTER TABLE public.expense_splits DROP COLUMN IF EXISTS shares;

----------------------------------------------------------------------
-- 1b. DROP settled_at + auto-settle trigger
----------------------------------------------------------------------

DROP TRIGGER IF EXISTS on_expense_split_status_change ON public.expense_splits;
DROP FUNCTION IF EXISTS public.auto_settle_expense();
ALTER TABLE public.expenses DROP COLUMN IF EXISTS settled_at;

----------------------------------------------------------------------
-- 1c. ADD updated_by audit column
----------------------------------------------------------------------

ALTER TABLE public.expenses
  ADD COLUMN updated_by UUID REFERENCES public.users(id) DEFAULT NULL;
