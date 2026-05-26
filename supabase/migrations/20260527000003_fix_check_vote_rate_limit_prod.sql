-- Fix: check_vote_rate_limit on prod is missing two improvements present on dev.
--
-- Prod had an older version where:
--   1. UPDATE operations that don't change the vote value still count toward the
--      60-votes/hour quota (false positives — no actual new vote cast).
--   2. The time window for UPDATE rows only checks created_at, not updated_at,
--      so a vote updated multiple times in the same hour is only counted once.
--
-- Dev version fixes both:
--   1. Early return when TG_OP = 'UPDATE' AND NEW.vote = OLD.vote.
--   2. Uses GREATEST(created_at, updated_at) so each vote change is counted.

CREATE OR REPLACE FUNCTION public.check_vote_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recent_count INT;
  v_window TIMESTAMPTZ := NOW() - INTERVAL '1 hour';
BEGIN
  -- For UPDATE: only rate-limit actual vote-value changes.
  IF TG_OP = 'UPDATE' AND NEW.vote = OLD.vote THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_recent_count
  FROM (
    SELECT 1 FROM public.activity_votes
      WHERE user_id = NEW.user_id
        AND trip_id = NEW.trip_id
        AND GREATEST(created_at, updated_at) > v_window
    UNION ALL
    SELECT 1 FROM public.accommodation_votes
      WHERE user_id = NEW.user_id
        AND trip_id = NEW.trip_id
        AND GREATEST(created_at, updated_at) > v_window
    UNION ALL
    SELECT 1 FROM public.transfer_flight_votes
      WHERE user_id = NEW.user_id
        AND trip_id = NEW.trip_id
        AND GREATEST(created_at, updated_at) > v_window
  ) sub;

  IF v_recent_count >= 60 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 60 votes per hour per trip';
  END IF;

  RETURN NEW;
END;
$$;
