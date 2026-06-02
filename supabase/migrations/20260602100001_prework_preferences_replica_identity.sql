-- prework_preferences: set REPLICA IDENTITY FULL so DELETE realtime events
-- include all columns (including topic_id) in payload.old.
-- Without this, the usePreworkRealtime hook falls back to a broad
-- invalidateQueries on every preference delete instead of targeting
-- the specific topic's cache.
ALTER TABLE public.prework_preferences REPLICA IDENTITY FULL;
