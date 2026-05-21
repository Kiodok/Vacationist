-- Prework Preferences
--
-- Creates:
--   public.prework_preferences  – per-member filter preferences for accommodation search
--   RLS policies for trip member access (SELECT all, INSERT/UPDATE/DELETE own only)

----------------------------------------------------------------------
-- 1. PREWORK_PREFERENCES TABLE
----------------------------------------------------------------------

CREATE TABLE public.prework_preferences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filters    JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(filters) = 'array'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

ALTER TABLE public.prework_preferences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER prework_preferences_updated_at
  BEFORE UPDATE ON public.prework_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

----------------------------------------------------------------------
-- 2. RLS POLICIES
----------------------------------------------------------------------

-- SELECT: any trip member can see all preferences for their trip
CREATE POLICY "prework_preferences_select_member"
  ON public.prework_preferences FOR SELECT TO authenticated
  USING (
    private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: any trip member can insert their own row
CREATE POLICY "prework_preferences_insert_member"
  ON public.prework_preferences FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: only own row
CREATE POLICY "prework_preferences_update_own"
  ON public.prework_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: only own row
CREATE POLICY "prework_preferences_delete_own"
  ON public.prework_preferences FOR DELETE TO authenticated
  USING (user_id = auth.uid());

----------------------------------------------------------------------
-- 3. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_prework_preferences_trip_id ON public.prework_preferences(trip_id);
