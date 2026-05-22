-- Phase: Profile Settings – Security Hardening
-- Addresses CRITICAL and HIGH findings from security review:
--   1. Audit logging for organizer document access
--   2. Member revocation of granted access
--   3. Per-trip rate limit (not per-organizer) on access requests
--   4. Request age check in respond_to_document_access_request (TOCTOU fix)
--   5. ISO alpha-2 and date format validation in upsert_travel_document
--   6. get_my_active_grants RPC so members can see what they have shared

-- ─── Audit log ──────────────────────────────────────────────────────────────

CREATE TABLE public.document_access_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id       UUID        NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  member_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type TEXT        NOT NULL,
  accessed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.document_access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_doc_audit_organizer   ON public.document_access_audit_log (organizer_id);
CREATE INDEX idx_doc_audit_member      ON public.document_access_audit_log (member_id);
CREATE INDEX idx_doc_audit_accessed_at ON public.document_access_audit_log (accessed_at DESC);

-- Organizer sees their own entries; member sees when their data was accessed.
CREATE POLICY "doc_audit_log_select"
  ON public.document_access_audit_log
  FOR SELECT TO authenticated
  USING (organizer_id = auth.uid() OR member_id = auth.uid());

CREATE POLICY "doc_audit_log_no_direct_insert"
  ON public.document_access_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- ─── upsert_travel_document: add ISO code + date format validation ───────────

CREATE OR REPLACE FUNCTION public.upsert_travel_document(
  p_document_type    TEXT,
  p_full_legal_name  TEXT,
  p_document_number  TEXT,
  p_date_of_birth    TEXT    DEFAULT NULL,
  p_nationality      TEXT    DEFAULT NULL,
  p_issuing_country  TEXT    DEFAULT NULL,
  p_expiry_date      DATE    DEFAULT NULL,
  p_notes            TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_key    TEXT;
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_document_type NOT IN ('passport', 'id_card') THEN
    RAISE EXCEPTION 'Invalid document type: %', p_document_type;
  END IF;

  IF length(trim(p_full_legal_name)) = 0 OR length(p_full_legal_name) > 200 THEN
    RAISE EXCEPTION 'full_legal_name must be 1–200 characters';
  END IF;

  IF length(trim(p_document_number)) = 0 OR length(p_document_number) > 50 THEN
    RAISE EXCEPTION 'document_number must be 1–50 characters';
  END IF;

  IF p_date_of_birth IS NOT NULL AND p_date_of_birth !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'date_of_birth must be in YYYY-MM-DD format';
  END IF;

  IF p_nationality IS NOT NULL AND p_nationality !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'nationality must be a 2-letter ISO alpha-2 code (e.g. DE)';
  END IF;

  IF p_issuing_country IS NOT NULL AND p_issuing_country !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'issuing_country must be a 2-letter ISO alpha-2 code (e.g. DE)';
  END IF;

  v_key := private.get_travel_doc_encryption_key();
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  INSERT INTO public.user_travel_documents (
    user_id, document_type, full_legal_name, document_number,
    date_of_birth, nationality, issuing_country, expiry_date, notes
  )
  VALUES (
    v_caller,
    p_document_type,
    extensions.pgp_sym_encrypt(trim(p_full_legal_name), v_key),
    extensions.pgp_sym_encrypt(trim(p_document_number), v_key),
    CASE WHEN p_date_of_birth IS NOT NULL
         THEN extensions.pgp_sym_encrypt(p_date_of_birth, v_key) END,
    p_nationality,
    p_issuing_country,
    p_expiry_date,
    CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
         THEN extensions.pgp_sym_encrypt(trim(p_notes), v_key) END
  )
  ON CONFLICT (user_id, document_type) DO UPDATE SET
    full_legal_name  = extensions.pgp_sym_encrypt(trim(p_full_legal_name), v_key),
    document_number  = extensions.pgp_sym_encrypt(trim(p_document_number), v_key),
    date_of_birth    = CASE WHEN p_date_of_birth IS NOT NULL
                            THEN extensions.pgp_sym_encrypt(p_date_of_birth, v_key) END,
    nationality      = p_nationality,
    issuing_country  = p_issuing_country,
    expiry_date      = p_expiry_date,
    notes            = CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
                            THEN extensions.pgp_sym_encrypt(trim(p_notes), v_key) END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── create_document_access_request: per-trip rate limit ────────────────────

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

  -- Rate limit: 1 request per trip per 24 h regardless of which organizer sent it.
  IF EXISTS (
    SELECT 1 FROM public.document_access_requests
    WHERE trip_id = p_trip_id
      AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RAISE EXCEPTION 'A document access request was already sent for this trip in the last 24 hours';
  END IF;

  INSERT INTO public.document_access_requests (trip_id, requested_by, duration_minutes)
  VALUES (p_trip_id, v_caller, p_duration_minutes)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ─── respond_to_document_access_request: add request age check ──────────────

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

  -- Reject stale requests — prevents responding to a prompt that is no longer visible
  -- on the sender's screen (TOCTOU mitigation).
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

  IF p_granted THEN
    v_expires_at := NOW() + (v_request.duration_minutes || ' minutes')::INTERVAL;
  END IF;

  INSERT INTO public.document_access_grants (request_id, user_id, granted, expires_at)
  VALUES (p_request_id, v_caller, p_granted, v_expires_at);
END;
$$;

-- ─── get_accessible_member_documents: add audit log insert ──────────────────

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

  -- Record every document viewed in this call for compliance / audit trail.
  INSERT INTO public.document_access_audit_log (organizer_id, trip_id, member_id, document_type)
  SELECT v_caller, p_trip_id, d.user_id, d.document_type
  FROM public.document_access_grants g
  JOIN public.document_access_requests r ON r.id = g.request_id
  JOIN public.user_travel_documents d    ON d.user_id = g.user_id
  WHERE r.trip_id      = p_trip_id
    AND r.requested_by = v_caller
    AND g.granted      = true
    AND g.expires_at   > NOW();

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

-- ─── revoke_document_access: member can withdraw a previously granted access ─

CREATE OR REPLACE FUNCTION public.revoke_document_access(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.document_access_grants
  SET granted = false, expires_at = NULL
  WHERE request_id = p_request_id
    AND user_id    = v_caller
    AND granted    = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active grant found to revoke';
  END IF;
END;
$$;

-- ─── get_my_active_grants: member sees what they currently share ─────────────

CREATE OR REPLACE FUNCTION public.get_my_active_grants()
RETURNS TABLE (
  grant_id         UUID,
  request_id       UUID,
  trip_id          UUID,
  trip_title       TEXT,
  requester_name   TEXT,
  requester_avatar TEXT,
  expires_at       TIMESTAMPTZ
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
    g.expires_at
  FROM public.document_access_grants g
  JOIN public.document_access_requests r ON r.id = g.request_id
  JOIN public.trips t                    ON t.id = r.trip_id
  JOIN public.users u                    ON u.id = r.requested_by
  WHERE g.user_id    = v_caller
    AND g.granted    = true
    AND g.expires_at > NOW()
  ORDER BY g.expires_at ASC;
END;
$$;
