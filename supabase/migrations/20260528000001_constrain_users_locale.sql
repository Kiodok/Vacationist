-- Normalize existing locale values to short codes
UPDATE public.users SET locale = 'de' WHERE locale = 'de-DE';
UPDATE public.users SET locale = 'en' WHERE locale NOT IN ('en', 'de');

-- Add CHECK constraint (only supported locales allowed going forward)
ALTER TABLE public.users
  ADD CONSTRAINT users_locale_supported
  CHECK (locale IN ('en', 'de'));

-- Update column default to short code
ALTER TABLE public.users
  ALTER COLUMN locale SET DEFAULT 'de';
