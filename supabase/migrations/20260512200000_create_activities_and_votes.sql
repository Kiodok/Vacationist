-- Phase 3: Activities & Voting System
--
-- Creates:
--   public.activities           – activity planning per trip
--   public.activity_votes       – non-numeric voting (must_do/like/open/skip/group_blocker)
--   public.soft_delete_activity – SECURITY DEFINER: organizer or participant-creator only
--   public.close_activity_voting – SECURITY DEFINER: organizer only
--   trigger: auto-finalize voting when all members have voted

----------------------------------------------------------------------
-- 1. ACTIVITIES TABLE
----------------------------------------------------------------------

CREATE TABLE public.activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (char_length(title) <= 100),
  description     TEXT CHECK (char_length(description) <= 1000),
  category        TEXT CHECK (char_length(category) <= 100),
  cost_estimate   NUMERIC(10,2),
  activity_date   DATE,
  start_time      TIME,
  end_time        TIME,
  external_url    TEXT CHECK (char_length(external_url) <= 2048),
  maps_url        TEXT CHECK (char_length(maps_url) <= 2048),
  status          TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'reserved', 'completed', 'skipped')),
  voting_open     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: trip members can view non-deleted activities
CREATE POLICY "activities_select_member"
  ON public.activities FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: any trip member can create activities
CREATE POLICY "activities_insert_member"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: organizer can update any, creator can update own
-- (soft delete + close voting use SECURITY DEFINER RPCs instead)
CREATE POLICY "activities_update_member"
  ON public.activities FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      private.is_trip_organizer(trip_id, auth.uid())
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND (
      private.is_trip_organizer(trip_id, auth.uid())
      OR created_by = auth.uid()
    )
  );

----------------------------------------------------------------------
-- 2. ACTIVITY_VOTES TABLE
----------------------------------------------------------------------

CREATE TABLE public.activity_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote            TEXT NOT NULL CHECK (vote IN ('must_do', 'like', 'open', 'skip', 'group_blocker')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, user_id)
);

ALTER TABLE public.activity_votes ENABLE ROW LEVEL SECURITY;

-- SELECT: trip members can see votes (visibility filtering is app-level)
CREATE POLICY "activity_votes_select_member"
  ON public.activity_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND a.deleted_at IS NULL
        AND private.is_trip_member(a.trip_id, auth.uid())
    )
  );

-- INSERT: trip member + voting must be open
CREATE POLICY "activity_votes_insert_member"
  ON public.activity_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
        AND private.is_trip_member(a.trip_id, auth.uid())
    )
  );

-- UPDATE: own vote + voting must be open (needed for UPSERT ON CONFLICT)
CREATE POLICY "activity_votes_update_own"
  ON public.activity_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
    )
  );

-- DELETE: own vote + voting must be open (allows re-voting via delete+insert)
CREATE POLICY "activity_votes_delete_own"
  ON public.activity_votes FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
    )
  );

----------------------------------------------------------------------
-- 3. AUTO-FINALIZE VOTING TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_finalize_activity_voting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id     UUID;
  v_voting_open BOOLEAN;
  v_member_count INT;
  v_vote_count   INT;
BEGIN
  SELECT a.trip_id, a.voting_open
    INTO v_trip_id, v_voting_open
    FROM public.activities a
   WHERE a.id = NEW.activity_id;

  IF NOT v_voting_open THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.activity_votes
   WHERE activity_id = NEW.activity_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.activities
       SET voting_open = FALSE
     WHERE id = NEW.activity_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_activity_vote_inserted
  AFTER INSERT OR UPDATE ON public.activity_votes
  FOR EACH ROW EXECUTE FUNCTION public.auto_finalize_activity_voting();

----------------------------------------------------------------------
-- 4. SOFT DELETE ACTIVITY (SECURITY DEFINER)
----------------------------------------------------------------------
-- Organizer can soft-delete any activity.
-- Participant (non-guest) can soft-delete their own.
-- Guest cannot soft-delete.

CREATE OR REPLACE FUNCTION public.soft_delete_activity(p_activity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id    UUID;
  v_created_by UUID;
  v_caller     UUID := auth.uid();
  v_role       TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, created_by
    INTO v_trip_id, v_created_by
    FROM public.activities
   WHERE id = p_activity_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  SELECT role INTO v_role
    FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  IF v_role = 'organizer' THEN
    -- organizer can delete any activity
    NULL;
  ELSIF v_role = 'participant' AND v_created_by = v_caller THEN
    -- participant can delete own
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.activities
     SET deleted_at = NOW()
   WHERE id = p_activity_id;
END;
$$;

----------------------------------------------------------------------
-- 5. CLOSE ACTIVITY VOTING (SECURITY DEFINER)
----------------------------------------------------------------------
-- Only organizers can manually close voting.

CREATE OR REPLACE FUNCTION public.close_activity_voting(p_activity_id UUID)
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
    RAISE EXCEPTION 'Only organizers can close voting';
  END IF;

  UPDATE public.activities
     SET voting_open = FALSE
   WHERE id = p_activity_id;
END;
$$;

----------------------------------------------------------------------
-- 6. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_activities_trip_id ON public.activities(trip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_created_by ON public.activities(created_by);
CREATE INDEX idx_activities_activity_date ON public.activities(activity_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_votes_activity_id ON public.activity_votes(activity_id);
CREATE INDEX idx_activity_votes_user_id ON public.activity_votes(user_id);
