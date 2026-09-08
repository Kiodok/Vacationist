-- Growth Plan Q4 2026, Phase 0. Every new non-guest user is auto-seeded a demo trip
-- (create-example-trip Edge Function, fired by trg_create_example_trip). The
-- product-funnel analytics added in the sibling migration 20260908130000
-- (invite_sent / expense_added) must not count a user poking at that demo trip as
-- real activation. The client needs a durable way to recognise it — the trip's
-- title and description are user-editable ("Edit or delete anything!"), so matching
-- on those is not reliable. This flag is that marker.
--
-- Additive, backwards-compatible: a constant DEFAULT is a metadata-only change (no
-- table rewrite); nothing reads the column until the client change ships. No RLS
-- change (ordinary readable column). Not an FK, so delete_own_account() is
-- unaffected.

ALTER TABLE public.trips
  ADD COLUMN is_example BOOLEAN NOT NULL DEFAULT false;

-- Best-effort backfill of demo trips created before this flag existed. Matches on
-- the seeded description (less likely to have been edited than the title). Imperfect
-- by design — the analytics funnel this feeds is forward-looking, and a demo trip
-- whose description was changed is indistinguishable from a real trip anyway.
UPDATE public.trips
SET is_example = true
WHERE description = 'An example trip to explore Vacationist. Edit or delete anything!'
  AND deleted_at IS NULL;
