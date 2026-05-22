-- Add trips table to realtime publication so UPDATE events (title, dates, budget,
-- timezone, etc.) are delivered to all trip members in real time.
--
-- REPLICA IDENTITY DEFAULT is sufficient here because the filter uses `id=eq.{tripId}`
-- and `id` is the primary key — always present in the WAL record without FULL.

ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
