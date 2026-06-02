-- delete_all_notifications(p_trip_id)
-- Deletes all notifications for the calling user.
-- If p_trip_id is provided, only deletes notifications for that trip.
CREATE OR REPLACE FUNCTION public.delete_all_notifications(
  p_trip_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_trip_id IS NOT NULL THEN
    DELETE FROM public.notifications
    WHERE user_id = auth.uid()
      AND trip_id = p_trip_id;
  ELSE
    DELETE FROM public.notifications
    WHERE user_id = auth.uid();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_all_notifications(UUID) TO authenticated;
