-- Task 19: Calendar tab shows a "has content" border even when nothing it can actually render
-- exists. Calendar reuses the `activities` flag (TAB_CONTENT_KEY.Calendar = 'activities' in
-- app/trip/[id]/index.tsx), which is true for *any* non-deleted activity — including date-less
-- ones (useCalendarActivities filters those out; the calendar can never render them) and
-- group_blocker-voting-open ones (also excluded from the calendar). A trip with only such
-- activities lights up the Calendar tab's border despite showing an empty calendar. Fix: give
-- Calendar its own flag, filtered the same way useCalendarActivities already filters
-- (activity_date IS NOT NULL) — not excluding blocked activities, since a blocked-but-dated
-- activity still renders *something* on the calendar via the existing AgendaItem rendering.
--
-- Also folded in here: `transfer_public_transport` (added this same release, 20260901140000)
-- was never added to the `transfer` flag's OR EXISTS chain, despite the original Public
-- Transport plan explicitly calling for it — a trip with only public-transport entries never
-- lit up the Transfer tab border. Same RPC, same migration pass, fixed alongside task 19.
--
-- RETURNS TABLE shape changes (a new column) — CREATE OR REPLACE FUNCTION cannot alter an
-- existing function's return type, so this must DROP first.

DROP FUNCTION IF EXISTS public.get_trip_tab_content(UUID);

CREATE FUNCTION public.get_trip_tab_content(p_trip_id UUID)
RETURNS TABLE(
  chat       BOOLEAN,
  prework    BOOLEAN,
  base       BOOLEAN,
  transfer   BOOLEAN,
  expenses   BOOLEAN,
  activities BOOLEAN,
  calendar   BOOLEAN,
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
      OR EXISTS (SELECT 1 FROM public.transfer_public_transport WHERE trip_id = p_trip_id AND deleted_at IS NULL)
    ) AS transfer,
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE trip_id = p_trip_id AND archived_at IS NULL
    ) AS expenses,
    EXISTS (
      SELECT 1 FROM public.activities
      WHERE trip_id = p_trip_id AND deleted_at IS NULL
    ) AS activities,
    EXISTS (
      SELECT 1 FROM public.activities
      WHERE trip_id = p_trip_id AND deleted_at IS NULL AND activity_date IS NOT NULL
    ) AS calendar,
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
