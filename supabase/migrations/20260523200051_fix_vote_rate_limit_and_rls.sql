-- Security fixes: Findings 5 and 6
--
-- FINDING 5: Vote rate limit only fires on INSERT. A user cycling a vote value
-- via UPDATE bypasses the 60-vote/hour cap.
-- Fix: add updated_at to all three vote tables so the rate limit can also
-- track UPDATE-based changes, then extend triggers to fire on INSERT OR UPDATE.
--
-- FINDING 6: activity_votes and transfer_flight_votes UPDATE USING clause is
-- only `user_id = auth.uid()`, so an ex-member whose vote row still exists can
-- update it. Fix: add private.is_trip_member(trip_id, auth.uid()) to USING.

----------------------------------------------------------------------
-- 1. ADD updated_at TO VOTE TABLES
----------------------------------------------------------------------

ALTER TABLE public.activity_votes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.accommodation_votes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.transfer_flight_votes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

----------------------------------------------------------------------
-- 2. TRIGGER: stamp updated_at on every vote-value change
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stamp_vote_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_activity_vote_updated_at
  BEFORE UPDATE ON public.activity_votes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_vote_updated_at();

CREATE OR REPLACE TRIGGER trg_accommodation_vote_updated_at
  BEFORE UPDATE ON public.accommodation_votes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_vote_updated_at();

CREATE OR REPLACE TRIGGER trg_transfer_flight_vote_updated_at
  BEFORE UPDATE ON public.transfer_flight_votes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_vote_updated_at();

----------------------------------------------------------------------
-- 3. REWRITE check_vote_rate_limit to handle INSERT and UPDATE
--    On UPDATE: skip unchanged votes, count via updated_at recency.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_vote_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_recent_count INT;
  v_window TIMESTAMPTZ := NOW() - INTERVAL '1 hour';
BEGIN
  -- For UPDATE: only rate-limit actual vote-value changes.
  IF TG_OP = 'UPDATE' AND NEW.vote = OLD.vote THEN
    RETURN NEW;
  END IF;

  -- Count votes from the last hour across all three tables.
  -- For INSERT rows: use created_at (row doesn't exist yet, so updated_at
  -- is irrelevant). For UPDATE rows: use GREATEST(created_at, updated_at)
  -- so recycled old rows are still counted once per change cycle.
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

-- Extend the rate-limit triggers to fire on INSERT OR UPDATE.
-- The stamp_vote_updated_at trigger fires BEFORE UPDATE first (order by name),
-- so updated_at is already current when the rate-limit trigger reads it.

DROP TRIGGER IF EXISTS on_activity_vote_rate_limit ON public.activity_votes;
CREATE TRIGGER on_activity_vote_rate_limit
  BEFORE INSERT OR UPDATE ON public.activity_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_vote_rate_limit();

DROP TRIGGER IF EXISTS on_accommodation_vote_rate_limit ON public.accommodation_votes;
CREATE TRIGGER on_accommodation_vote_rate_limit
  BEFORE INSERT OR UPDATE ON public.accommodation_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_vote_rate_limit();

DROP TRIGGER IF EXISTS on_transfer_flight_vote_rate_limit ON public.transfer_flight_votes;
CREATE TRIGGER on_transfer_flight_vote_rate_limit
  BEFORE INSERT OR UPDATE ON public.transfer_flight_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_vote_rate_limit();

----------------------------------------------------------------------
-- 4. FIX activity_votes UPDATE USING — add trip membership check
--    (Finding 6: ex-members could update lingering vote rows)
----------------------------------------------------------------------

DROP POLICY IF EXISTS "activity_votes_update_own" ON public.activity_votes;

CREATE POLICY "activity_votes_update_own"
  ON public.activity_votes FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
        AND private.is_trip_member(a.trip_id, auth.uid())
    )
  );

----------------------------------------------------------------------
-- 5. FIX transfer_flight_votes UPDATE USING — add trip membership check
----------------------------------------------------------------------

DROP POLICY IF EXISTS "transfer_flight_votes_update_own" ON public.transfer_flight_votes;

CREATE POLICY "transfer_flight_votes_update_own"
  ON public.transfer_flight_votes FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.transfer_flights f
      WHERE f.id = flight_id
        AND f.voting_open = TRUE
        AND f.deleted_at IS NULL
        AND private.is_trip_member(f.trip_id, auth.uid())
    )
  );

----------------------------------------------------------------------
-- 6. UPDATE composite rate-limit indexes to include updated_at
----------------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_activity_votes_rate_limit;
CREATE INDEX IF NOT EXISTS idx_activity_votes_rate_limit
  ON public.activity_votes(user_id, trip_id, created_at DESC, updated_at DESC);

DROP INDEX IF EXISTS public.idx_accommodation_votes_rate_limit;
CREATE INDEX IF NOT EXISTS idx_accommodation_votes_rate_limit
  ON public.accommodation_votes(user_id, trip_id, created_at DESC, updated_at DESC);

DROP INDEX IF EXISTS public.idx_transfer_flight_votes_rate_limit;
CREATE INDEX IF NOT EXISTS idx_transfer_flight_votes_rate_limit
  ON public.transfer_flight_votes(user_id, trip_id, created_at DESC, updated_at DESC);
