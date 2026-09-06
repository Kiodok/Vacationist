-- v1.35.0+ — Store download badges in the web app
--
-- Adds a per-user opt-out for the "Get it on Play Store" / "Get it on App Store" badges that
-- render next to the avatar on the global Trips tab and next to the alerts bell inside a trip
-- (web.vacationist.app only — the badges are Platform.OS === 'web' guarded on the client).
--
-- Additive and backwards-compatible: every existing row backfills to TRUE (badges shown), which
-- matches the intended default for the users this targets — web sign-ups who have not installed
-- the native app yet.
--
-- No RLS work: users_update_own (20260511000001_create_users_table.sql) is column-agnostic, and
-- restrict_user_self_update() (20260523195339) only guards is_guest. No delete_own_account()
-- change — this is a plain column on an existing table, not a new FK to public.users.

ALTER TABLE public.users
  ADD COLUMN show_store_badges BOOLEAN NOT NULL DEFAULT TRUE;
