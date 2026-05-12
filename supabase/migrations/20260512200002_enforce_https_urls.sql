-- Enforce https:// URL scheme at the database level for activities.
-- Prevents malicious URL injection (javascript:, data:, etc.) bypassing client-side Zod validation.

ALTER TABLE public.activities
  ADD CONSTRAINT activities_external_url_https
    CHECK (external_url IS NULL OR external_url LIKE 'https://%');

ALTER TABLE public.activities
  ADD CONSTRAINT activities_maps_url_https
    CHECK (maps_url IS NULL OR maps_url LIKE 'https://%');
