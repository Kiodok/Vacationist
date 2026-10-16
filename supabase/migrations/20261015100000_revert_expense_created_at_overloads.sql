-- INCIDENT FIX — full revert of 20261014100000_expense_created_at_editable.sql's RPC changes.
--
-- Root cause: CREATE OR REPLACE FUNCTION only replaces a function in place when the argument
-- TYPES match exactly. 20261014100000 added a trailing p_created_at parameter to
-- create_expense_with_splits / update_expense_with_splits / update_expense_metadata — since that
-- changes each function's argument type list, Postgres did NOT replace anything: it silently
-- created a SECOND overload of each function, leaving the original (no p_created_at) version
-- still present. Confirmed via `database.types.ts`, which showed all three RPCs as a union of two
-- distinct `Args` shapes on both dev and prod.
--
-- Impact: the live prod client (nothing from the session that added p_created_at was ever
-- committed/shipped) calls these RPCs with the OLD argument shape only. With two overloads now
-- present, PostgREST cannot disambiguate and rejects the call at the API-gateway layer — before
-- it ever reaches Postgres, which is why this surfaced as a silent failure: no Postgres error, no
-- Sentry capture (isExpectedMutationError already treats any PGRST* code as "expected"), no
-- console output, no network-layer error. This broke expense create AND edit for every user on
-- prod, not just booking-linked expenses.
--
-- This exact trap already hit this codebase once before, for book_transfer_flight
-- (20260905150000 + the follow-up drop in 20260905180000) — the lesson wasn't carried forward.
--
-- Fix: drop the NEW (p_created_at-bearing) overload of each function, restoring the original
-- (untouched, still-present) overload as the sole version. Tech Lead's explicit call: a full
-- revert, not a drop-the-old-keep-the-new fix — the created_at-editable feature will be
-- redeployed later, in the same migration as its (already-written, uncommitted) client code, and
-- that migration will explicitly DROP FUNCTION the old signatures this time instead of relying on
-- CREATE OR REPLACE alone.

DROP FUNCTION public.create_expense_with_splits(
  uuid, text, numeric, text, uuid, text, uuid, text, jsonb, text, boolean, numeric, uuid, timestamptz
);

DROP FUNCTION public.update_expense_with_splits(
  uuid, text, numeric, uuid, text, jsonb, text, text, text, boolean, numeric, timestamptz
);

DROP FUNCTION public.update_expense_metadata(
  uuid, text, text, text, boolean, timestamptz
);
