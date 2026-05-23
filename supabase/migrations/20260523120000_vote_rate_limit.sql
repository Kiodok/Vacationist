-- Phase 9: Security — max 60 votes per user per trip per hour (aggregate across all vote tables)
-- Prevents automated vote spam. Pattern mirrors check_invite_rate_limit trigger.

CREATE OR REPLACE FUNCTION public.check_vote_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_recent_count INT;
BEGIN
  SELECT (
    (SELECT COUNT(*) FROM public.activity_votes
      WHERE user_id = NEW.user_id AND trip_id = NEW.trip_id
        AND created_at > NOW() - INTERVAL '1 hour')
    +
    (SELECT COUNT(*) FROM public.accommodation_votes
      WHERE user_id = NEW.user_id AND trip_id = NEW.trip_id
        AND created_at > NOW() - INTERVAL '1 hour')
    +
    (SELECT COUNT(*) FROM public.transfer_flight_votes
      WHERE user_id = NEW.user_id AND trip_id = NEW.trip_id
        AND created_at > NOW() - INTERVAL '1 hour')
  ) INTO v_recent_count;

  IF v_recent_count >= 60 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 60 votes per hour per trip';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_activity_vote_rate_limit
  BEFORE INSERT ON public.activity_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_vote_rate_limit();

CREATE TRIGGER on_accommodation_vote_rate_limit
  BEFORE INSERT ON public.accommodation_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_vote_rate_limit();

CREATE TRIGGER on_transfer_flight_vote_rate_limit
  BEFORE INSERT ON public.transfer_flight_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_vote_rate_limit();
