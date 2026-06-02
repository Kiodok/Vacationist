-- reset_all_prework_preferences(p_trip_id): organizer-only bulk delete.
-- The RLS DELETE policy on prework_preferences only allows deleting own rows
-- (user_id = auth.uid()), so this SECURITY DEFINER RPC is needed for the
-- organizer to clear all members' preferences for a clean restart.
CREATE OR REPLACE FUNCTION public.reset_all_prework_preferences(
  p_trip_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_trip_organizer(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the trip organizer can reset all preferences';
  END IF;

  DELETE FROM public.prework_preferences
  WHERE trip_id = p_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_all_prework_preferences(UUID) TO authenticated;
