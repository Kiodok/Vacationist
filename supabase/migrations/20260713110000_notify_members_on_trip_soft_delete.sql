-- Notify all non-organizer trip members when an organizer soft-deletes the trip.
-- Notification is created BEFORE setting deleted_at so trip_members is still queryable.

CREATE OR REPLACE FUNCTION public.soft_delete_trip(p_trip_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_title TEXT;
  v_actor_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_organizer(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: only organizers can delete a trip';
  END IF;

  -- Fetch context for notification before the trip is hidden
  SELECT title INTO v_trip_title FROM public.trips WHERE id = p_trip_id AND deleted_at IS NULL;
  SELECT name  INTO v_actor_name FROM public.users WHERE id = auth.uid();

  -- Notify all non-organizer members while trip_members is still intact
  IF v_trip_title IS NOT NULL THEN
    PERFORM private.create_trip_notification(
      p_trip_id,
      auth.uid(),
      'trip_deleted',
      'Trip deleted',
      NULL,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT,
      v_trip_title,
      v_actor_name
    );
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
