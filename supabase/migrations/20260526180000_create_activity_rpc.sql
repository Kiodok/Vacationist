-- Fix: activity creation fails on the production build because the direct INSERT
-- against activities_insert_member RLS policy can fail even when membership is
-- valid (e.g. stale private schema, plan-dependent short-circuit differences).
--
-- Converts createActivity to a SECURITY DEFINER RPC, matching the pattern
-- already used by soft_delete_activity, close_activity_voting, etc.
-- The function checks membership via auth.uid() internally and bypasses RLS.

CREATE OR REPLACE FUNCTION public.create_activity(
  p_trip_id        UUID,
  p_title          TEXT,
  p_description    TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT NULL,
  p_cost_estimate  NUMERIC DEFAULT NULL,
  p_activity_date  DATE    DEFAULT NULL,
  p_start_time     TIME    DEFAULT NULL,
  p_end_time       TIME    DEFAULT NULL,
  p_external_url   TEXT    DEFAULT NULL,
  p_maps_url       TEXT    DEFAULT NULL
)
RETURNS SETOF public.activities
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  RETURN QUERY
  INSERT INTO public.activities (
    trip_id, title, description, category, cost_estimate,
    activity_date, start_time, end_time, external_url, maps_url,
    created_by
  )
  VALUES (
    p_trip_id, p_title, p_description, p_category, p_cost_estimate,
    p_activity_date, p_start_time, p_end_time, p_external_url, p_maps_url,
    v_caller
  )
  RETURNING *;
END;
$$;
