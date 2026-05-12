-- Fix soft-delete trip RLS violation.
--
-- Root cause: PostgreSQL 16+ applies SELECT policies as implicit WITH CHECK
-- constraints on UPDATE. After setting deleted_at, the new row fails
-- trips_select_member's (deleted_at IS NULL) check, causing a 42501 error
-- even though the organizer UPDATE policy passes.
--
-- Fix: SECURITY DEFINER function that bypasses RLS and performs its own
-- authorization check, so the UPDATE runs as the function owner and is
-- not subject to the caller's SELECT policy.

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
END;
$$;
