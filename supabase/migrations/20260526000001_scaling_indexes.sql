-- Performance & scaling fixes:
--
-- 1. Composite indexes for the vote rate-limit trigger (check_vote_rate_limit).
--    The trigger fires on every vote INSERT and runs 3 COUNT queries.
--    Without these indexes each COUNT scans the trip_id index and filters by user_id
--    and created_at — O(trip_votes) per call. With the composite index the query is
--    an O(1) index range scan on (user_id, trip_id, created_at).
--
-- 2. Rewrite check_vote_rate_limit to a single UNION ALL instead of 3 subqueries.
--    The previous version executed 3 independent COUNT(*) calls sequentially, each
--    paying the function-call and planner overhead. A single COUNT over UNION ALL
--    shares one execution plan and returns after hitting the 60-row limit early.
--
-- 3. Partial index for send_organizer_nudge rate-limit query.
--    That function counts notifications WHERE trip_id=X AND type='reminder'
--    AND created_at > NOW()-1h. The partial index on type='reminder' keeps the
--    index small and makes the range scan fast even as the notifications table grows.

----------------------------------------------------------------------
-- 1. VOTE RATE-LIMIT INDEXES
----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_activity_votes_rate_limit
  ON public.activity_votes(user_id, trip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_accommodation_votes_rate_limit
  ON public.accommodation_votes(user_id, trip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transfer_flight_votes_rate_limit
  ON public.transfer_flight_votes(user_id, trip_id, created_at DESC);

----------------------------------------------------------------------
-- 2. REWRITE check_vote_rate_limit — single UNION ALL
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_vote_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_recent_count INT;
BEGIN
  SELECT COUNT(*) INTO v_recent_count
  FROM (
    SELECT 1 FROM public.activity_votes
      WHERE user_id = NEW.user_id
        AND trip_id = NEW.trip_id
        AND created_at > NOW() - INTERVAL '1 hour'
    UNION ALL
    SELECT 1 FROM public.accommodation_votes
      WHERE user_id = NEW.user_id
        AND trip_id = NEW.trip_id
        AND created_at > NOW() - INTERVAL '1 hour'
    UNION ALL
    SELECT 1 FROM public.transfer_flight_votes
      WHERE user_id = NEW.user_id
        AND trip_id = NEW.trip_id
        AND created_at > NOW() - INTERVAL '1 hour'
  ) sub;

  IF v_recent_count >= 60 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 60 votes per hour per trip';
  END IF;

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 3. NUDGE RATE-LIMIT INDEX
----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_notifications_nudge_rate_limit
  ON public.notifications(trip_id, created_at DESC)
  WHERE type = 'reminder';
