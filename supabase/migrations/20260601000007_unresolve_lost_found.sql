-- Allow trip members to revert a Lost & Found case back to unresolved.

CREATE OR REPLACE FUNCTION public.unresolve_lost_found_case(p_case_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_trip_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id INTO v_trip_id
  FROM public.lost_found_cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  IF NOT private.is_trip_member(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.lost_found_cases
  SET is_resolved = FALSE, resolved_at = NULL
  WHERE id = p_case_id;
END;
$$;
