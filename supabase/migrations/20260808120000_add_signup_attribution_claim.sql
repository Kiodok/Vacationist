-- Phase 14 follow-up: fix a structural bug in "is this a new sign-up" detection.
--
-- ensureUserProfile() (packages/api/src/users.ts) infers isNew from whether a
-- public.users row already exists for the session's user id. That is always
-- false: on_auth_user_created -> handle_new_user() (20260511000001) inserts
-- the public.users row server-side the instant auth.users gets a new row,
-- which happens before the client ever runs ensureUserProfile's SELECT. So
-- isNew's "true" branch is dead code for every real sign-up, not just a race
-- under fast re-testing -- this is what made the Reddit SignUp conversion
-- (Phase 14, trackSignUp.ts) never fire, even for a genuinely new account.
--
-- Fix: stop inferring novelty from row existence. Track "have we already
-- reported this account's sign-up attribution" as an explicit, atomically
-- claimed column instead. A single `UPDATE ... WHERE signup_attribution_claimed_at
-- IS NULL RETURNING id` is race-safe under Postgres row locking even if
-- loadSession() and onAuthStateChange both resolve for the same fresh
-- sign-in concurrently (see useAuthInit.ts) -- only one caller's UPDATE can
-- return a row. This also naturally covers guest-upgrade-to-real-account:
-- guests are blocked from claiming while is_guest = true (see
-- trg_restrict_user_self_update, 20260523195339), so the column stays
-- unclaimed until they convert, at which point the first claim attempt wins.

ALTER TABLE public.users
  ADD COLUMN signup_attribution_claimed_at TIMESTAMPTZ;
