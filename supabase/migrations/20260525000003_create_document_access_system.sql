-- Phase: Profile Settings
-- Time-limited organizer access to trip members' travel documents.
-- Organizer creates a request (15 / 30 / 60 min). Each member individually grants
-- or denies. Grants are time-bounded via expires_at. Partial consent is fine.
-- All writes go through SECURITY DEFINER RPCs.

CREATE TABLE public.document_access_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID        NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  requested_by     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  duration_minutes INT         NOT NULL CHECK (duration_minutes IN (15, 30, 60)),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.document_access_grants (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID        NOT NULL REFERENCES public.document_access_requests(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted      BOOLEAN     NOT NULL,
  expires_at   TIMESTAMPTZ,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, user_id)
);

ALTER TABLE public.document_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_doc_access_requests_trip_id
  ON public.document_access_requests (trip_id);
CREATE INDEX idx_doc_access_requests_requested_by
  ON public.document_access_requests (requested_by);
CREATE INDEX idx_doc_access_grants_request_id
  ON public.document_access_grants (request_id);
CREATE INDEX idx_doc_access_grants_user_id
  ON public.document_access_grants (user_id);
CREATE INDEX idx_doc_access_grants_expires_at
  ON public.document_access_grants (expires_at)
  WHERE granted = true;

-- Requests: trip members can read (to discover pending requests).
CREATE POLICY "doc_access_requests_select_member"
  ON public.document_access_requests
  FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "doc_access_requests_no_direct_insert"
  ON public.document_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- Grants: own rows, or the organizer who made the request.
CREATE POLICY "doc_access_grants_select"
  ON public.document_access_grants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.document_access_requests r
      WHERE r.id = request_id AND r.requested_by = auth.uid()
    )
  );

CREATE POLICY "doc_access_grants_no_direct_insert"
  ON public.document_access_grants
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- ─── RPCs ──────────────────────────────────────────────────────────────────

-- create_document_access_request: organizer-only.
-- Rate-limited to 1 active request per trip per 24 hours to prevent spam.
CREATE OR REPLACE FUNCTION public.create_document_access_request(
  p_trip_id          UUID,
  p_duration_minutes INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_request_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_organizer(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only trip organizers can request document access';
  END IF;

  IF p_duration_minutes NOT IN (15, 30, 60) THEN
    RAISE EXCEPTION 'Duration must be 15, 30, or 60 minutes';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.document_access_requests
    WHERE trip_id = p_trip_id
      AND requested_by = v_caller
      AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RAISE EXCEPTION 'You already have a recent pending request for this trip. Wait 24 hours before creating a new one.';
  END IF;

  INSERT INTO public.document_access_requests (trip_id, requested_by, duration_minutes)
  VALUES (p_trip_id, v_caller, p_duration_minutes)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- respond_to_document_access_request: member responds (not the organizer who requested).
-- Sets expires_at = NOW() + duration_minutes if granted.
CREATE OR REPLACE FUNCTION public.respond_to_document_access_request(
  p_request_id UUID,
  p_granted    BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_request    RECORD;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_request
  FROM public.document_access_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request not found';
  END IF;

  IF NOT private.is_trip_member(v_request.trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;

  IF v_caller = v_request.requested_by THEN
    RAISE EXCEPTION 'Cannot respond to your own access request';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.document_access_grants
    WHERE request_id = p_request_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Already responded to this request';
  END IF;

  IF p_granted THEN
    v_expires_at := NOW() + (v_request.duration_minutes || ' minutes')::INTERVAL;
  END IF;

  INSERT INTO public.document_access_grants (request_id, user_id, granted, expires_at)
  VALUES (p_request_id, v_caller, p_granted, v_expires_at);
END;
$$;

-- get_my_pending_access_requests: returns requests the caller has not yet responded to.
-- Used to populate the banner on the Profile screen.
CREATE OR REPLACE FUNCTION public.get_my_pending_access_requests()
RETURNS TABLE (
  request_id       UUID,
  trip_id          UUID,
  trip_title       TEXT,
  requested_by     UUID,
  requester_name   TEXT,
  requester_avatar TEXT,
  duration_minutes INT,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    r.id              AS request_id,
    r.trip_id,
    t.title           AS trip_title,
    r.requested_by,
    u.name            AS requester_name,
    u.avatar_url      AS requester_avatar,
    r.duration_minutes,
    r.created_at
  FROM public.document_access_requests r
  JOIN public.trips t ON t.id = r.trip_id
  JOIN public.users u ON u.id = r.requested_by
  WHERE private.is_trip_member(r.trip_id, v_caller)
    AND r.requested_by <> v_caller
    AND r.created_at > NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.document_access_grants g
      WHERE g.request_id = r.id AND g.user_id = v_caller
    )
  ORDER BY r.created_at DESC;
END;
$$;

-- get_accessible_member_documents: organizer only.
-- Returns decrypted documents for trip members who have an active (non-expired) grant.
CREATE OR REPLACE FUNCTION public.get_accessible_member_documents(p_trip_id UUID)
RETURNS TABLE (
  user_id          UUID,
  user_name        TEXT,
  user_avatar      TEXT,
  document_type    TEXT,
  full_legal_name  TEXT,
  document_number  TEXT,
  date_of_birth    TEXT,
  nationality      TEXT,
  issuing_country  TEXT,
  expiry_date      DATE,
  notes            TEXT,
  grant_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_key    TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_organizer(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only trip organizers can view member documents';
  END IF;

  v_key := private.get_travel_doc_encryption_key();

  RETURN QUERY
  SELECT
    d.user_id,
    u.name                                                          AS user_name,
    u.avatar_url                                                    AS user_avatar,
    d.document_type,
    extensions.pgp_sym_decrypt(d.full_legal_name, v_key)           AS full_legal_name,
    extensions.pgp_sym_decrypt(d.document_number, v_key)           AS document_number,
    CASE WHEN d.date_of_birth IS NOT NULL
         THEN extensions.pgp_sym_decrypt(d.date_of_birth, v_key) END AS date_of_birth,
    d.nationality,
    d.issuing_country,
    d.expiry_date,
    CASE WHEN d.notes IS NOT NULL
         THEN extensions.pgp_sym_decrypt(d.notes, v_key) END AS notes,
    g.expires_at                                                    AS grant_expires_at
  FROM public.document_access_grants g
  JOIN public.document_access_requests r ON r.id = g.request_id
  JOIN public.user_travel_documents d    ON d.user_id = g.user_id
  JOIN public.users u                    ON u.id = d.user_id
  WHERE r.trip_id       = p_trip_id
    AND r.requested_by  = v_caller
    AND g.granted       = true
    AND g.expires_at    > NOW()
  ORDER BY u.name ASC, d.document_type ASC;
END;
$$;
