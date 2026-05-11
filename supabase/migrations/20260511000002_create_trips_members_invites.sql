-- Phase 2: Create trips, trip_members, and invite_tokens tables
-- These are interdependent (RLS policies cross-reference) so they must be created together

----------------------------------------------------------------------
-- 1. TABLES
----------------------------------------------------------------------

CREATE TABLE public.trips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  budget_per_person NUMERIC(10,2),
  base_currency   TEXT NOT NULL DEFAULT 'EUR' CHECK (base_currency IN ('EUR', 'CHF')),
  timezone        TEXT NOT NULL DEFAULT 'Europe/Berlin',
  status          TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  created_by      UUID NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT trips_dates_check CHECK (end_date >= start_date)
);

CREATE TABLE public.trip_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('organizer', 'participant', 'guest')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trip_id, user_id)
);

CREATE TABLE public.invite_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  created_by      UUID NOT NULL REFERENCES public.users(id),
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ DEFAULT NULL,
  revoked_at      TIMESTAMPTZ DEFAULT NULL,
  max_uses        INT DEFAULT NULL,
  use_count       INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

----------------------------------------------------------------------
-- 2. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_trips_created_by ON public.trips(created_by);
CREATE INDEX idx_trips_status ON public.trips(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_trip_members_user_id ON public.trip_members(user_id);
CREATE INDEX idx_trip_members_trip_id ON public.trip_members(trip_id);
CREATE INDEX idx_invite_tokens_token ON public.invite_tokens(token);
CREATE INDEX idx_invite_tokens_trip_id ON public.invite_tokens(trip_id);

----------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
----------------------------------------------------------------------

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- trips: Members can view trips they belong to (soft-deleted hidden)
CREATE POLICY "trips_select_member"
  ON public.trips FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trips.id
        AND trip_members.user_id = auth.uid()
    )
  );

-- trips: Any authenticated user can create a trip
CREATE POLICY "trips_insert_authenticated"
  ON public.trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- trips: Only organizers can update
CREATE POLICY "trips_update_organizer"
  ON public.trips FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trips.id
        AND trip_members.user_id = auth.uid()
        AND trip_members.role = 'organizer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trips.id
        AND trip_members.user_id = auth.uid()
        AND trip_members.role = 'organizer'
    )
  );

-- trip_members: Members can see co-members
CREATE POLICY "trip_members_select"
  ON public.trip_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members AS my
      WHERE my.trip_id = trip_members.trip_id
        AND my.user_id = auth.uid()
    )
  );

-- trip_members: Self-insert or organizer-insert
CREATE POLICY "trip_members_insert"
  ON public.trip_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trip_members AS org
      WHERE org.trip_id = trip_members.trip_id
        AND org.user_id = auth.uid()
        AND org.role = 'organizer'
    )
  );

-- trip_members: Organizers can change roles
CREATE POLICY "trip_members_update"
  ON public.trip_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members AS org
      WHERE org.trip_id = trip_members.trip_id
        AND org.user_id = auth.uid()
        AND org.role = 'organizer'
    )
  );

-- trip_members: Self-remove or organizer-remove
CREATE POLICY "trip_members_delete"
  ON public.trip_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trip_members AS org
      WHERE org.trip_id = trip_members.trip_id
        AND org.user_id = auth.uid()
        AND org.role = 'organizer'
    )
  );

-- invite_tokens: Organizers can view
CREATE POLICY "invite_tokens_select_organizer"
  ON public.invite_tokens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = invite_tokens.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.role = 'organizer'
    )
  );

-- invite_tokens: Organizers can create
CREATE POLICY "invite_tokens_insert_organizer"
  ON public.invite_tokens FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = invite_tokens.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.role = 'organizer'
    )
  );

-- invite_tokens: Organizers can update (revoke)
CREATE POLICY "invite_tokens_update_organizer"
  ON public.invite_tokens FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = invite_tokens.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.role = 'organizer'
    )
  );

----------------------------------------------------------------------
-- 4. TRIGGERS
----------------------------------------------------------------------

-- Auto-add trip creator as organizer
CREATE OR REPLACE FUNCTION public.handle_new_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'organizer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_trip_created
  AFTER INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_trip();

----------------------------------------------------------------------
-- 5. INVITE TOKEN REDEMPTION FUNCTION
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.redeem_invite_token(token_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_token RECORD;
  v_user_id UUID;
  v_is_guest BOOLEAN;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_token
  FROM public.invite_tokens
  WHERE token = token_value
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  IF v_token.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite link has been revoked';
  END IF;

  IF v_token.expires_at < NOW() THEN
    RAISE EXCEPTION 'This invite link has expired';
  END IF;

  IF v_token.max_uses IS NOT NULL AND v_token.use_count >= v_token.max_uses THEN
    RAISE EXCEPTION 'This invite link has reached its usage limit';
  END IF;

  -- Already a member — just return the trip
  IF EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = v_token.trip_id AND user_id = v_user_id
  ) THEN
    RETURN v_token.trip_id;
  END IF;

  SELECT is_guest INTO v_is_guest FROM public.users WHERE id = v_user_id;
  v_role := CASE WHEN v_is_guest THEN 'guest' ELSE 'participant' END;

  UPDATE public.invite_tokens
  SET use_count = use_count + 1
  WHERE id = v_token.id;

  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (v_token.trip_id, v_user_id, v_role);

  RETURN v_token.trip_id;
END;
$$;
