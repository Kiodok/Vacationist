-- Fixes a mistake in the immediately-preceding migration
-- (20260901100000_add_expense_description_and_category_edit.sql): adding a new trailing
-- p_description parameter to create_expense_with_splits via CREATE OR REPLACE does not replace
-- the old 9-arg function — Postgres identifies a function by its argument type list, so a
-- 9-arg and a 10-arg signature are different functions, and the old one was left behind
-- alongside the new one. Two resolvable overloads for the same PostgREST call is exactly the
-- ambiguity bug this repo hit before (see 20260809110001_drop_old_update_expense_overload.sql)
-- — confirmed here by `npx supabase gen types` emitting two Args variants for
-- create_expense_with_splits after the previous migration, whereas update_expense_with_splits
-- (which DID explicitly drop its old overload first) emitted only one.

DROP FUNCTION IF EXISTS public.create_expense_with_splits(UUID, TEXT, NUMERIC, TEXT, UUID, TEXT, UUID, TEXT, JSONB);
