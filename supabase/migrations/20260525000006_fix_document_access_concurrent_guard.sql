-- Remove the 24-hour rate limit on document access requests.
-- Replace it with a concurrent-request guard: at most one active request
-- per trip at any point in time.
--
-- A request is considered active when either:
--   a) it was created within its own duration_minutes window (still pending), or
--   b) at least one grant tied to it is still non-expired.
-- Once both conditions are false the organizer may send a new request.

CREATE OR REPLACE FUNCTION public.create_document_access_request(
  p_trip_id          UUID,
  p_duration_minutes INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_request_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_organizer(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only trip organizers can request document access';
  END IF;

  IF p_duration_minutes NOT IN (15, 30, 60) THEN
    RAISE EXCEPTION 'Duration must be 15, 30, or 60 minutes';
  END IF;

  -- Block if there is already an active request for this trip.
  IF EXISTS (
    SELECT 1 FROM public.document_access_requests r
    WHERE r.trip_id = p_trip_id
      AND (
        r.created_at > NOW() - (r.duration_minutes || ' minutes')::INTERVAL
        OR EXISTS (
          SELECT 1 FROM public.document_access_grants g
          WHERE g.request_id = r.id
            AND g.granted    = true
            AND g.expires_at > NOW()
        )
      )
  ) THEN
    RAISE EXCEPTION 'There is already an active document access request for this trip';
  END IF;

  INSERT INTO public.document_access_requests (trip_id, requested_by, duration_minutes)
  VALUES (p_trip_id, v_caller, p_duration_minutes)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;
