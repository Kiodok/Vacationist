-- Phase 5c: Realtime Expenses
-- Adds expense tables to Supabase Realtime publication
-- Sets REPLICA IDENTITY FULL on expense_splits so DELETE events include all columns

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_splits;

-- REPLICA IDENTITY FULL ensures DELETE payloads contain all columns (not just PK).
-- update_expense_with_splits deletes and recreates splits, so DELETE events
-- need expense_id for client-side trip filtering.
ALTER TABLE public.expense_splits REPLICA IDENTITY FULL;
