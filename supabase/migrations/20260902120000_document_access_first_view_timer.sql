-- v1.33.0 — Travel-document access: the countdown now starts when the ORGANIZER first opens a
-- member's documents, per member, instead of at grant time. An un-opened grant auto-expires
-- after a 7-day outer deadline.
--
-- Why: the 15/30/60-minute window used to burn down from the moment a member tapped "Grant"
-- — while the organizer was at work, asleep, or before they'd collected every passenger's
-- passport for a booking. Grant-time start also made "open all passports simultaneously"
-- impossible when members granted at different times.
--
-- Model change on public.document_access_grants:
--   * grant_deadline TIMESTAMPTZ  — set at grant time to NOW() + 7 days. Outer window.
--   * activated_at   TIMESTAMPTZ  — NULL until the organizer first reveals THIS member's docs.
--   * expires_at     TIMESTAMPTZ  — now NULL until activation, then activated_at + duration.

-- ─── Schema ─────────────────────────────────────────────────────────────────

ALTER TABLE public.document_access_grants
  ADD COLUMN IF NOT EXISTS activated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grant_deadline TIMESTAMPTZ;

-- Backfill any existing granted rows: keep their current behaviour (clock already running).
UPDATE public.document_access_grants
SET grant_deadline = COALESCE(grant_deadline, expires_at, NOW() + INTERVAL '7 days'),
    activated_at   = COALESCE(activated_at, CASE WHEN expires_at IS NOT NULL THEN responded_at END)
WHERE granted = true
  AND grant_deadline IS NULL;

CREATE INDEX IF NOT EXISTS idx_doc_access_grants_deadline
  ON public.document_access_grants (grant_deadline) WHERE granted = true;

-- ─── respond_to_document_access_request: set grant_deadline, not expires_at ──

CREATE OR REPLACE FUNCTION public.respond_to_document_access_request(
  p_request_id UUID,
  p_granted    BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller       UUID := auth.uid();
  v_request      RECORD;
  v_deadline     TIMESTAMPTZ;
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

  IF v_request.created_at < NOW() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'This access request has expired';
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

  -- The minutes-long timer no longer starts here — only the 7-day outer window does. The
  -- organizer's first reveal_member_documents() call starts the real countdown.
  IF p_granted THEN
    v_deadline := NOW() + INTERVAL '7 days';
  END IF;

  INSERT INTO public.document_access_grants (request_id, user_id, granted, expires_at, grant_deadline)
  VALUES (p_request_id, v_caller, p_granted, NULL, v_deadline);
END;
$$;

-- ─── create_document_access_request: guard counts un-activated grants too ────

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

  -- Active = still-pending request window, OR a grant that is either not yet activated but
  -- within its 7-day deadline, or activated and not yet expired.
  IF EXISTS (
    SELECT 1 FROM public.document_access_requests r
    WHERE r.trip_id = p_trip_id
      AND (
        r.created_at > NOW() - (r.duration_minutes || ' minutes')::INTERVAL
        OR EXISTS (
          SELECT 1 FROM public.document_access_grants g
          WHERE g.request_id = r.id
            AND g.granted     = true
            AND (
              (g.expires_at IS NULL AND g.grant_deadline > NOW())
              OR g.expires_at > NOW()
            )
        )
      )
  ) THEN
    RAISE EXCEPTION 'There is already an active document access request for this trip';
  END IF;

  INSERT INTO public.document_access_requests (trip_id, requested_by, duration_minutes)
  VALUES (p_trip_id, v_caller, p_duration_minutes)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ─── get_member_document_access_list: metadata only, no decrypt, no audit ────

CREATE OR REPLACE FUNCTION public.get_member_document_access_list(p_trip_id UUID)
RETURNS TABLE (
  user_id        UUID,
  user_name      TEXT,
  user_avatar    TEXT,
  document_type  TEXT,
  activated_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  grant_deadline TIMESTAMPTZ
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

  IF NOT private.is_trip_organizer(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only trip organizers can view member documents';
  END IF;

  RETURN QUERY
  SELECT
    d.user_id,
    u.name        AS user_name,
    u.avatar_url  AS user_avatar,
    d.document_type,
    g.activated_at,
    g.expires_at,
    g.grant_deadline
  FROM public.document_access_grants g
  JOIN public.document_access_requests r ON r.id = g.request_id
  JOIN public.user_travel_documents d    ON d.user_id = g.user_id
  JOIN public.users u                    ON u.id = d.user_id
  WHERE r.trip_id      = p_trip_id
    AND r.requested_by = v_caller
    AND g.granted      = true
    AND g.grant_deadline > NOW()
    AND (g.expires_at IS NULL OR g.expires_at > NOW())
  ORDER BY u.name ASC, d.document_type ASC;
END;
$$;

-- ─── reveal_member_documents: starts the clock on first call, decrypts, audits ──

CREATE OR REPLACE FUNCTION public.reveal_member_documents(
  p_trip_id        UUID,
  p_member_user_id UUID
)
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
  v_caller       UUID := auth.uid();
  v_key          TEXT;
  v_grant        RECORD;
  v_effective_expires TIMESTAMPTZ;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_organizer(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only trip organizers can view member documents';
  END IF;

  SELECT g.*, r.duration_minutes
  INTO v_grant
  FROM public.document_access_grants g
  JOIN public.document_access_requests r ON r.id = g.request_id
  WHERE r.trip_id      = p_trip_id
    AND r.requested_by = v_caller
    AND g.user_id      = p_member_user_id
    AND g.granted      = true
  ORDER BY g.responded_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active document access grant for this member';
  END IF;

  IF v_grant.grant_deadline <= NOW() THEN
    RAISE EXCEPTION 'This document access grant expired before it was opened';
  END IF;

  v_effective_expires := v_grant.expires_at;

  -- First open: start the real countdown now.
  IF v_grant.activated_at IS NULL THEN
    UPDATE public.document_access_grants
    SET activated_at = NOW(),
        expires_at   = NOW() + (v_grant.duration_minutes || ' minutes')::INTERVAL
    WHERE id = v_grant.id
    RETURNING expires_at INTO v_effective_expires;
  END IF;

  IF v_effective_expires <= NOW() THEN
    RAISE EXCEPTION 'This document access grant has expired';
  END IF;

  v_key := private.get_travel_doc_encryption_key();

  INSERT INTO public.document_access_audit_log (organizer_id, trip_id, member_id, document_type)
  SELECT v_caller, p_trip_id, d.user_id, d.document_type
  FROM public.user_travel_documents d
  WHERE d.user_id = p_member_user_id;

  RETURN QUERY
  SELECT
    d.user_id,
    u.name                                                          AS user_name,
    u.avatar_url                                                    AS user_avatar,
    d.document_type,
    extensions.pgp_sym_decrypt(d.full_legal_name, v_key)            AS full_legal_name,
    extensions.pgp_sym_decrypt(d.document_number, v_key)            AS document_number,
    CASE WHEN d.date_of_birth IS NOT NULL
         THEN extensions.pgp_sym_decrypt(d.date_of_birth, v_key) END AS date_of_birth,
    d.nationality,
    d.issuing_country,
    d.expiry_date,
    CASE WHEN d.notes IS NOT NULL
         THEN extensions.pgp_sym_decrypt(d.notes, v_key) END        AS notes,
    v_effective_expires                                             AS grant_expires_at
  FROM public.user_travel_documents d
  JOIN public.users u ON u.id = d.user_id
  WHERE d.user_id = p_member_user_id
  ORDER BY d.document_type ASC;
END;
$$;

-- The bulk all-members RPC is superseded by the two above (its expires_at > NOW() filter
-- would now hide every un-activated grant anyway, and it re-audited every member on every
-- 15s poll).
DROP FUNCTION IF EXISTS public.get_accessible_member_documents(UUID);

-- ─── get_my_active_grants: show un-activated (within-deadline) grants too ────

-- Adding OUT columns changes the return row type, which CREATE OR REPLACE cannot do.
DROP FUNCTION IF EXISTS public.get_my_active_grants();

CREATE OR REPLACE FUNCTION public.get_my_active_grants()
RETURNS TABLE (
  grant_id         UUID,
  request_id       UUID,
  trip_id          UUID,
  trip_title       TEXT,
  requester_name   TEXT,
  requester_avatar TEXT,
  expires_at       TIMESTAMPTZ,
  activated_at     TIMESTAMPTZ,
  grant_deadline   TIMESTAMPTZ
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
    g.id             AS grant_id,
    g.request_id,
    r.trip_id,
    t.title          AS trip_title,
    u.name           AS requester_name,
    u.avatar_url     AS requester_avatar,
    g.expires_at,
    g.activated_at,
    g.grant_deadline
  FROM public.document_access_grants g
  JOIN public.document_access_requests r ON r.id = g.request_id
  JOIN public.trips t                    ON t.id = r.trip_id
  JOIN public.users u                    ON u.id = r.requested_by
  WHERE g.user_id = v_caller
    AND g.granted = true
    AND (
      (g.expires_at IS NULL AND g.grant_deadline > NOW())
      OR g.expires_at > NOW()
    )
  ORDER BY COALESCE(g.expires_at, g.grant_deadline) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_document_access_list(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_member_documents(UUID, UUID) TO authenticated;
