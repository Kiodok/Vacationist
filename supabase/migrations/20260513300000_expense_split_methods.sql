-- Add split method support to expenses and shares to expense_splits.
-- Enables even, exact amount, and shares-based splitting.

ALTER TABLE public.expenses
  ADD COLUMN split_method TEXT NOT NULL DEFAULT 'even'
  CHECK (split_method IN ('even', 'exact', 'shares'));

ALTER TABLE public.expense_splits
  ADD COLUMN shares INT DEFAULT NULL CHECK (shares IS NULL OR shares > 0);
