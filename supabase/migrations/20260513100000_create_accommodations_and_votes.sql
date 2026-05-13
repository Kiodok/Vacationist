-- Phase 4a: Accommodations & Voting System
--
-- Creates:
--   public.accommodations           – accommodation suggestions per trip
--   public.accommodation_votes      – non-numeric voting (must_do/like/open/skip/group_blocker)
--   public.soft_delete_accommodation – SECURITY DEFINER: organizer or participant-creator only
--   public.close_accommodation_voting – SECURITY DEFINER: organizer only
--   trigger: auto-finalize voting when all members have voted

----------------------------------------------------------------------
-- 1. ACCOMMODATIONS TABLE
----------------------------------------------------------------------

CREATE TABLE public.accommodations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (char_length(title) <= 100),
  description     TEXT CHECK (char_length(description) <= 1000),
  price_total     NUMERIC(10,2),
  external_url    TEXT CHECK (char_length(external_url) <= 2048),
  notes           TEXT CHECK (char_length(notes) <= 500),
  status          TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'requested', 'reserved', 'booked', 'completed')),
  voting_open     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER accommodations_updated_at
  BEFORE UPDATE ON public.accommodations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforce https:// URLs at DB level
ALTER TABLE public.accommodations
  ADD CONSTRAINT accommodations_external_url_https
  CHECK (external_url IS NULL OR external_url LIKE 'https://%');

-- SELECT: trip members can view non-deleted accommodations
CREATE POLICY "accommodations_select_member"
  ON public.accommodations FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: any trip member can create accommodations
CREATE POLICY "accommodations_insert_member"
  ON public.accommodations FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: organizer can update any, creator can update own
CREATE POLICY "accommodations_update_member"
  ON public.accommodations FOR UPDATE TO authenticated
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
-- 2. RESTRICT UPDATE FIELDS (prevent non-organizers from changing status/voting_open)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_accommodation_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  IF NOT private.is_trip_organizer(OLD.trip_id, auth.uid()) THEN
    IF NEW.voting_open IS DISTINCT FROM OLD.voting_open THEN
      RAISE EXCEPTION 'Only organizers can change voting_open';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only organizers can change status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_accommodation_update_restrict
  BEFORE UPDATE ON public.accommodations
  FOR EACH ROW EXECUTE FUNCTION public.restrict_accommodation_update_fields();

----------------------------------------------------------------------
-- 3. ACCOMMODATION_VOTES TABLE
----------------------------------------------------------------------

CREATE TABLE public.accommodation_votes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id    UUID NOT NULL REFERENCES public.accommodations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote                TEXT NOT NULL CHECK (vote IN ('must_do', 'like', 'open', 'skip', 'group_blocker')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (accommodation_id, user_id)
);

ALTER TABLE public.accommodation_votes ENABLE ROW LEVEL SECURITY;

-- SELECT: trip members can see votes
CREATE POLICY "accommodation_votes_select_member"
  ON public.accommodation_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accommodations a
      WHERE a.id = accommodation_id
        AND a.deleted_at IS NULL
        AND private.is_trip_member(a.trip_id, auth.uid())
    )
  );

-- INSERT: trip member + voting must be open
CREATE POLICY "accommodation_votes_insert_member"
  ON public.accommodation_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.accommodations a
      WHERE a.id = accommodation_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
        AND private.is_trip_member(a.trip_id, auth.uid())
    )
  );

-- UPDATE: own vote + voting must be open (needed for UPSERT ON CONFLICT)
CREATE POLICY "accommodation_votes_update_own"
  ON public.accommodation_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.accommodations a
      WHERE a.id = accommodation_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
    )
  );

-- DELETE: own vote + voting must be open
CREATE POLICY "accommodation_votes_delete_own"
  ON public.accommodation_votes FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.accommodations a
      WHERE a.id = accommodation_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
    )
  );

----------------------------------------------------------------------
-- 4. AUTO-FINALIZE VOTING TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_finalize_accommodation_voting()
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
    FROM public.accommodations a
   WHERE a.id = NEW.accommodation_id;

  IF NOT v_voting_open THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.accommodation_votes
   WHERE accommodation_id = NEW.accommodation_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.accommodations
       SET voting_open = FALSE
     WHERE id = NEW.accommodation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_accommodation_vote_inserted
  AFTER INSERT OR UPDATE ON public.accommodation_votes
  FOR EACH ROW EXECUTE FUNCTION public.auto_finalize_accommodation_voting();

----------------------------------------------------------------------
-- 5. SOFT DELETE ACCOMMODATION (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_accommodation(p_accommodation_id UUID)
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
    FROM public.accommodations
   WHERE id = p_accommodation_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Accommodation not found';
  END IF;

  SELECT role INTO v_role
    FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  IF v_role = 'organizer' THEN
    NULL;
  ELSIF v_role = 'participant' AND v_created_by = v_caller THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.accommodations
     SET deleted_at = NOW()
   WHERE id = p_accommodation_id;
END;
$$;

----------------------------------------------------------------------
-- 6. CLOSE ACCOMMODATION VOTING (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_accommodation_voting(p_accommodation_id UUID)
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
    RAISE EXCEPTION 'Only organizers can close voting';
  END IF;

  UPDATE public.accommodations
     SET voting_open = FALSE
   WHERE id = p_accommodation_id;
END;
$$;

----------------------------------------------------------------------
-- 7. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_accommodations_trip_id ON public.accommodations(trip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accommodations_created_by ON public.accommodations(created_by);
CREATE INDEX idx_accommodation_votes_accommodation_id ON public.accommodation_votes(accommodation_id);
CREATE INDEX idx_accommodation_votes_user_id ON public.accommodation_votes(user_id);
