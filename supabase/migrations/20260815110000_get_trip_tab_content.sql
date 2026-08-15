-- v1.31.0: "has data" indicator for the trip tab bar. Returns one boolean per
-- content tab so the client can draw a border on inactive, populated tabs.
--
-- SECURITY INVOKER (not this repo's usual SECURITY DEFINER RPC convention) —
-- deliberate. Two source tables have per-caller row visibility that a DEFINER
-- function would silently widen:
--   - packing_items:      SELECT policy is `user_id = auth.uid()` (private per user)
--   - lost_found_cases:   SELECT policy is `created_by = auth.uid() OR target_user =
--                          auth.uid() OR target_user IS NULL`
-- Running as INVOKER lets normal RLS scope every EXISTS to the caller, so the
-- "stuff" flag means "*I* have packing items or visible cases", not "someone does".

CREATE OR REPLACE FUNCTION public.get_trip_tab_content(p_trip_id UUID)
RETURNS TABLE(
  chat       BOOLEAN,
  prework    BOOLEAN,
  base       BOOLEAN,
  transfer   BOOLEAN,
  expenses   BOOLEAN,
  activities BOOLEAN,
  stuff      BOOLEAN,
  shopping   BOOLEAN,
  notes      BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1 FROM public.trip_messages
      WHERE trip_id = p_trip_id AND deleted_at IS NULL
    ) AS chat,
    EXISTS (
      SELECT 1 FROM public.prework_topics
      WHERE trip_id = p_trip_id
    ) AS prework,
    EXISTS (
      SELECT 1 FROM public.accommodations
      WHERE trip_id = p_trip_id AND deleted_at IS NULL
    ) AS base,
    (
      EXISTS (SELECT 1 FROM public.transfer_flights WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.transfer_vehicles WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.transfer_rentals WHERE trip_id = p_trip_id AND deleted_at IS NULL)
    ) AS transfer,
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE trip_id = p_trip_id AND archived_at IS NULL
    ) AS expenses,
    EXISTS (
      SELECT 1 FROM public.activities
      WHERE trip_id = p_trip_id AND deleted_at IS NULL
    ) AS activities,
    (
      EXISTS (SELECT 1 FROM public.packing_items WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.shared_packing_items WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.lost_found_cases WHERE trip_id = p_trip_id)
    ) AS stuff,
    (
      EXISTS (SELECT 1 FROM public.shopping_lists WHERE trip_id = p_trip_id AND archived_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.shopping_items WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.recipes WHERE trip_id = p_trip_id)
    ) AS shopping,
    EXISTS (
      SELECT 1 FROM public.trip_notes
      WHERE trip_id = p_trip_id
    ) AS notes;
END;
$$;
