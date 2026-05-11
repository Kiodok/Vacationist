-- Rate-limit invite token creation: max 10 per organizer per trip per hour
CREATE OR REPLACE FUNCTION public.check_invite_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  recent_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.invite_tokens
  WHERE trip_id = NEW.trip_id
    AND created_by = NEW.created_by
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 10 invite tokens per hour per trip';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_invite_token_rate_limit
  BEFORE INSERT ON public.invite_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.check_invite_rate_limit();

-- Tighten trip_members INSERT: only organizers can insert directly.
-- SECURITY DEFINER functions (handle_new_trip, redeem_invite_token) bypass RLS.
DROP POLICY IF EXISTS "trip_members_insert" ON public.trip_members;

CREATE POLICY "trip_members_insert_organizer_or_system"
  ON public.trip_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members tm
      WHERE tm.trip_id = trip_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'organizer'
    )
  );
