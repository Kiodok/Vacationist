-- Phase 5b: Realtime Voting for Activities & Accommodations
-- Adds vote tables and entity tables to Supabase Realtime publication
-- Sets REPLICA IDENTITY FULL on vote tables so DELETE events include all columns

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accommodation_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accommodations;

-- REPLICA IDENTITY FULL ensures DELETE payloads contain all columns (not just PK).
-- Without this, realtime DELETE events only include {id}, making it impossible
-- to determine which entity the deleted vote belonged to.
ALTER TABLE public.activity_votes REPLICA IDENTITY FULL;
ALTER TABLE public.accommodation_votes REPLICA IDENTITY FULL;
