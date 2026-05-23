-- Security fix: nudge rate limit counted notification rows (N rows per nudge for
-- N-1 members), so a trip with 4+ members could only send 1 nudge before the
-- 3-row limit tripped. Fix: generate a per-nudge UUID and pass it as related_id;
-- count DISTINCT related_id to count nudge events, not notification rows.
--
-- Also adds input length guards (Finding 7): title ≤ 100 chars, body ≤ 300 chars.

CREATE OR REPLACE FUNCTION public.send_organizer_nudge(
  p_trip_id UUID,
  p_title   TEXT,
  p_body    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller      UUID    := auth.uid();
  v_nudge_count INTEGER;
  v_nudge_id    UUID    := gen_random_uuid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_organizer(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only trip organizers can send nudges';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Nudge title is required';
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Nudge body is required';
  END IF;

  -- Finding 7: length guards
  IF length(trim(p_title)) > 100 THEN
    RAISE EXCEPTION 'Nudge title must be 100 characters or fewer';
  END IF;
  IF length(trim(p_body)) > 300 THEN
    RAISE EXCEPTION 'Nudge body must be 300 characters or fewer';
  END IF;

  -- Rate limit: count distinct nudge events (related_id) in the last hour,
  -- not individual notification rows.
  SELECT COUNT(DISTINCT related_id) INTO v_nudge_count
  FROM public.notifications
  WHERE trip_id = p_trip_id
    AND type = 'reminder'
    AND related_type = 'nudge'
    AND related_id IS NOT NULL
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_nudge_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit: max 3 nudges per trip per hour';
  END IF;

  PERFORM private.create_trip_notification(
    p_trip_id,
    v_caller,
    'reminder',
    trim(p_title),
    trim(p_body),
    'nudge',       -- related_type marks this as a nudge event
    v_nudge_id     -- shared across all member rows for this nudge
  );
END;
$$;

-- Update the partial index to also filter on related_type so the rate-limit
-- query stays a fast index range scan even as notifications grow.
DROP INDEX IF EXISTS public.idx_notifications_nudge_rate_limit;
CREATE INDEX IF NOT EXISTS idx_notifications_nudge_rate_limit
  ON public.notifications(trip_id, related_id, created_at DESC)
  WHERE type = 'reminder' AND related_type = 'nudge';
