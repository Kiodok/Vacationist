-- Extend soft_delete_trip to also revoke all active invite tokens for the trip.
-- Tokens must be revoked on soft delete — the ON DELETE CASCADE on invite_tokens.trip_id
-- only fires on hard deletes, which we never do.

CREATE OR REPLACE FUNCTION public.soft_delete_trip(p_trip_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_organizer(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: only organizers can delete a trip';
  END IF;

  UPDATE public.trips
  SET deleted_at = NOW()
  WHERE id = p_trip_id
    AND deleted_at IS NULL;

  -- Revoke all active invite tokens so existing links can no longer be redeemed
  UPDATE public.invite_tokens
  SET revoked_at = NOW()
  WHERE trip_id = p_trip_id
    AND revoked_at IS NULL;
END;
$$;
