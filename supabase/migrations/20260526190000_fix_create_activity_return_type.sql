-- Fix: create_activity was returning SETOF public.activities which React Native
-- client did not consume correctly (array[0] access fails at runtime on mobile
-- even though web works). Switch to RETURNS UUID — same pattern as
-- upsert_travel_document — and let the caller fetch the full row separately.
-- DROP required because PostgreSQL forbids changing return type via CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.create_activity(UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, TIME, TIME, TEXT, TEXT);

CREATE FUNCTION public.create_activity(
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
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

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
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
