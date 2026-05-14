-- Re-open voting functions for activities and accommodations (organizer only)

CREATE OR REPLACE FUNCTION public.reopen_activity_voting(p_activity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
  v_caller  UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id INTO v_trip_id
    FROM public.activities
   WHERE id = p_activity_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only organizers can re-open voting';
  END IF;

  UPDATE public.activities
     SET voting_open = TRUE
   WHERE id = p_activity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_accommodation_voting(p_accommodation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
  v_caller  UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id INTO v_trip_id
    FROM public.accommodations
   WHERE id = p_accommodation_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Accommodation not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only organizers can re-open voting';
  END IF;

  UPDATE public.accommodations
     SET voting_open = TRUE
   WHERE id = p_accommodation_id;
END;
$$;
