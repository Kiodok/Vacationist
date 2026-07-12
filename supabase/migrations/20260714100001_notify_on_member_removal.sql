-- Extend cleanup_votes_on_member_removal() to also send a member_left notification
-- to all remaining trip members when someone leaves or is removed.
--
-- context_entity: 'left' for voluntary leave, 'removed' for organizer kick.
-- Since this runs inside a trigger (pg_trigger_depth() >= 1), the notification rows
-- are inserted but push dispatch defers to the pg_cron polling job (~60s).

CREATE OR REPLACE FUNCTION public.cleanup_votes_on_member_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_title   TEXT;
  v_member_name  TEXT;
  v_reason       TEXT;
BEGIN
  DELETE FROM public.activity_votes
  WHERE user_id = OLD.user_id
    AND activity_id IN (
      SELECT id FROM public.activities WHERE trip_id = OLD.trip_id AND deleted_at IS NULL
    );

  DELETE FROM public.accommodation_votes
  WHERE user_id = OLD.user_id
    AND accommodation_id IN (
      SELECT id FROM public.accommodations WHERE trip_id = OLD.trip_id AND deleted_at IS NULL
    );

  DELETE FROM public.transfer_flight_votes
  WHERE user_id = OLD.user_id
    AND flight_id IN (
      SELECT id FROM public.transfer_flights WHERE trip_id = OLD.trip_id AND deleted_at IS NULL
    );

  DELETE FROM public.transfer_vehicle_passengers
  WHERE user_id = OLD.user_id
    AND vehicle_id IN (
      SELECT id FROM public.transfer_vehicles
      WHERE trip_id = OLD.trip_id AND deleted_at IS NULL
    );

  DELETE FROM public.prework_preferences
  WHERE user_id = OLD.user_id
    AND trip_id = OLD.trip_id;

  -- Notify remaining members that someone left or was removed.
  SELECT title INTO v_trip_title
  FROM public.trips
  WHERE id = OLD.trip_id AND deleted_at IS NULL;

  IF v_trip_title IS NULL THEN
    -- Trip was soft-deleted (trip_deleted notification already sent) — skip.
    RETURN OLD;
  END IF;

  SELECT name INTO v_member_name
  FROM public.users
  WHERE id = OLD.user_id;

  -- Determine if this is a voluntary leave or an organizer kick.
  v_reason := CASE WHEN auth.uid() = OLD.user_id THEN 'left' ELSE 'removed' END;

  PERFORM private.create_trip_notification(
    OLD.trip_id,        -- p_trip_id
    OLD.user_id,        -- p_exclude_user_id (don't notify the person who left)
    'member_left',      -- p_type
    'Member left',      -- p_title (overridden by client i18n)
    NULL,               -- p_body
    NULL,               -- p_related_type
    NULL,               -- p_related_id
    v_reason,           -- p_context_entity ('left' or 'removed')
    v_trip_title,       -- p_context_trip
    v_member_name       -- p_context_creator
  );

  RETURN OLD;
END;
$$;
