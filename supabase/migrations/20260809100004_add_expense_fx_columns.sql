-- Phase 15: Multi-Currency Expense Support — Step 5: per-expense FX conversion columns
--
-- exchange_rate / converted_amount are resolved and FROZEN at expense creation/edit time
-- (never recalculated retroactively — matches the existing "never hard-delete, preserve
-- history" philosophy for expenses). converted_amount is what balance/settlement math sums
-- from here on (see 20260809100007_fix_balance_rpcs_converted_amount.sql), not raw amount.
--
-- Every existing row gets exchange_rate = 1, converted_amount = amount — numerically
-- identical to today's behavior for every trip that has only ever used one currency, which
-- is every trip that exists today (CreateExpenseSheet never exposed a currency picker before
-- this phase).
--
-- amount_owed_original_currency preserves what the user actually typed/saw when an expense's
-- currency differs from the trip's base currency (the split UI always displays amounts in the
-- expense's own currency). expense_splits.amount_owed keeps its existing meaning unchanged —
-- the base-currency amount used by every balance/settlement calculation.

ALTER TABLE public.expenses
  ADD COLUMN exchange_rate NUMERIC(18,8) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0);

ALTER TABLE public.expenses
  ADD COLUMN converted_amount NUMERIC(10,2);

UPDATE public.expenses SET converted_amount = amount WHERE converted_amount IS NULL;

ALTER TABLE public.expenses
  ALTER COLUMN converted_amount SET NOT NULL,
  ADD CONSTRAINT expenses_converted_amount_check CHECK (converted_amount > 0);

ALTER TABLE public.expense_splits
  ADD COLUMN amount_owed_original_currency NUMERIC(10,2);

ALTER TABLE public.users
  ADD COLUMN preferred_currency TEXT REFERENCES public.currency_catalog(code);
