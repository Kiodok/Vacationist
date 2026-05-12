-- Fix infinite recursion in trip_members RLS policies.
--
-- Root cause: trip_members_select queries trip_members from its own USING
-- clause, triggering itself recursively. Every policy on trips and
-- invite_tokens that references trip_members cascades into the same loop.
--
-- Fix: SECURITY DEFINER helper functions in a private schema (not exposed
-- via the Data API) that bypass RLS for membership checks, then rewrite
-- all affected policies to call those helpers.

----------------------------------------------------------------------
-- 0. PRIVATE SCHEMA
----------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

----------------------------------------------------------------------
-- 1. HELPER FUNCTIONS (bypass RLS, private schema)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_trip_member(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id
      AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_trip_organizer(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id
      AND user_id = p_user_id
      AND role = 'organizer'
  );
$$;

----------------------------------------------------------------------
-- 2. REWRITE trips POLICIES
----------------------------------------------------------------------

DROP POLICY IF EXISTS "trips_select_member" ON public.trips;
CREATE POLICY "trips_select_member"
  ON public.trips FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      created_by = auth.uid()
      OR private.is_trip_member(id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "trips_update_organizer" ON public.trips;
CREATE POLICY "trips_update_organizer"
  ON public.trips FOR UPDATE TO authenticated
  USING (private.is_trip_organizer(id, auth.uid()))
  WITH CHECK (private.is_trip_organizer(id, auth.uid()));

----------------------------------------------------------------------
-- 3. REWRITE trip_members POLICIES
----------------------------------------------------------------------

DROP POLICY IF EXISTS "trip_members_select" ON public.trip_members;
CREATE POLICY "trip_members_select"
  ON public.trip_members FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "trip_members_insert_organizer_or_system" ON public.trip_members;
CREATE POLICY "trip_members_insert_organizer_or_system"
  ON public.trip_members FOR INSERT TO authenticated
  WITH CHECK (private.is_trip_organizer(trip_id, auth.uid()));

DROP POLICY IF EXISTS "trip_members_update" ON public.trip_members;
CREATE POLICY "trip_members_update"
  ON public.trip_members FOR UPDATE TO authenticated
  USING (private.is_trip_organizer(trip_id, auth.uid()));

DROP POLICY IF EXISTS "trip_members_delete" ON public.trip_members;
CREATE POLICY "trip_members_delete"
  ON public.trip_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_trip_organizer(trip_id, auth.uid())
  );

----------------------------------------------------------------------
-- 4. REWRITE invite_tokens POLICIES
----------------------------------------------------------------------

DROP POLICY IF EXISTS "invite_tokens_select_organizer" ON public.invite_tokens;
CREATE POLICY "invite_tokens_select_organizer"
  ON public.invite_tokens FOR SELECT TO authenticated
  USING (private.is_trip_organizer(trip_id, auth.uid()));

DROP POLICY IF EXISTS "invite_tokens_insert_organizer" ON public.invite_tokens;
CREATE POLICY "invite_tokens_insert_organizer"
  ON public.invite_tokens FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND private.is_trip_organizer(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "invite_tokens_update_organizer" ON public.invite_tokens;
CREATE POLICY "invite_tokens_update_organizer"
  ON public.invite_tokens FOR UPDATE TO authenticated
  USING (private.is_trip_organizer(trip_id, auth.uid()));
