-- Allow anonymous users to preview trip details from an invite token
-- before signing in or entering their name, so the join screen can
-- show the trip name and dates.
--
-- The function is intentionally read-only and does NOT consume the token.
-- It validates the token is still usable (not expired, not revoked, not
-- exhausted) and returns a minimal preview — no sensitive data exposed.

CREATE OR REPLACE FUNCTION public.preview_invite_token(p_token TEXT)
RETURNS TABLE(trip_title TEXT, start_date DATE, end_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
BEGIN
  SELECT it.trip_id INTO v_trip_id
  FROM public.invite_tokens it
  WHERE it.token = p_token
    AND it.revoked_at  IS NULL
    AND it.expires_at  >  NOW()
    AND (it.max_uses IS NULL OR it.use_count < it.max_uses);

  IF v_trip_id IS NULL THEN
    RETURN; -- empty result set — caller treats this as invalid/expired
  END IF;

  RETURN QUERY
    SELECT t.title::TEXT, t.start_date, t.end_date
    FROM public.trips t
    WHERE t.id = v_trip_id
      AND t.deleted_at IS NULL;
END;
$$;

-- Grant execute to anon so the join screen (unauthenticated) can call it.
GRANT EXECUTE ON FUNCTION public.preview_invite_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.preview_invite_token(TEXT) TO authenticated;
