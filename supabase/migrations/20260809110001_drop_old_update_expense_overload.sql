-- Follow-up to 20260809110000: CREATE OR REPLACE only replaces a function whose positional
-- argument TYPES match exactly. 20260809110000's new p_currency-last signature
-- (UUID, TEXT, NUMERIC, UUID, TEXT, JSONB, TEXT) has a different positional type order than
-- 20260809100006's p_currency-fourth signature (UUID, TEXT, NUMERIC, TEXT, UUID, TEXT, JSONB)
-- — Postgres therefore created a second overload instead of replacing the first, which
-- reintroduces exactly the PostgREST ambiguity 20260809110000 was written to avoid. Drop the
-- now-orphaned old overload explicitly, leaving only the backward-compatible one.

DROP FUNCTION IF EXISTS public.update_expense_with_splits(UUID, TEXT, NUMERIC, TEXT, UUID, TEXT, JSONB);
