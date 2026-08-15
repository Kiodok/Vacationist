-- Add a location link (e.g. Google Maps) to accommodations/Base, mirroring activities.maps_url.
-- HTTPS-only, same pattern as 20260512200002_enforce_https_urls.sql for activities.

ALTER TABLE public.accommodations ADD COLUMN maps_url TEXT;

ALTER TABLE public.accommodations
  ADD CONSTRAINT accommodations_maps_url_https
    CHECK (maps_url IS NULL OR maps_url LIKE 'https://%');
