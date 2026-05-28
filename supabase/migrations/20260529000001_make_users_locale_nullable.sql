-- Allow NULL in users.locale so newly registered users get NULL instead of 'de'.
-- A NULL locale means "preference not yet saved"; the app uses the device locale
-- until the user explicitly saves one from Profile Settings.
--
-- Both the DEFAULT and the NOT NULL constraint must be dropped together:
-- dropping only the DEFAULT leaves NOT NULL in place, which would cause a
-- NOT NULL violation on every new registration (handle_new_user trigger omits
-- the locale column, so the row gets NULL).
--
-- Existing rows keep their current values ('en' or 'de' after the 20260528
-- normalisation migration). The CHECK constraint (locale IN ('en', 'de'))
-- already allows NULL in PostgreSQL (CHECK evaluates to NULL, not FALSE, for
-- NULL inputs — which counts as passing).
ALTER TABLE public.users ALTER COLUMN locale DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN locale DROP NOT NULL;
