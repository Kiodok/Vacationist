-- Fix: redeem_invite_token was not setting used_at on first redemption
CREATE OR REPLACE FUNCTION public.redeem_invite_token(token_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_token RECORD;
  v_user_id UUID;
  v_is_guest BOOLEAN;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_token
  FROM public.invite_tokens
  WHERE token = token_value
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  IF v_token.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite link has been revoked';
  END IF;

  IF v_token.expires_at < NOW() THEN
    RAISE EXCEPTION 'This invite link has expired';
  END IF;

  IF v_token.max_uses IS NOT NULL AND v_token.use_count >= v_token.max_uses THEN
    RAISE EXCEPTION 'This invite link has reached its usage limit';
  END IF;

  -- Already a member — just return the trip
  IF EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = v_token.trip_id AND user_id = v_user_id
  ) THEN
    RETURN v_token.trip_id;
  END IF;

  SELECT is_guest INTO v_is_guest FROM public.users WHERE id = v_user_id;
  v_role := CASE WHEN v_is_guest THEN 'guest' ELSE 'participant' END;

  UPDATE public.invite_tokens
  SET use_count = use_count + 1,
      used_at   = NOW()
  WHERE id = v_token.id;

  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (v_token.trip_id, v_user_id, v_role);

  RETURN v_token.trip_id;
END;
$$;
