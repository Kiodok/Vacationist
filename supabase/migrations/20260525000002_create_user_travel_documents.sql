-- Phase: Profile Settings
-- Stores per-user travel document PII (passport / ID card).
-- Sensitive fields are stored as BYTEA encrypted with pgp_sym_encrypt (AES-256).
-- All client access goes through SECURITY DEFINER RPCs — no direct DML from PostgREST.

CREATE TABLE public.user_travel_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type    TEXT        NOT NULL CHECK (document_type IN ('passport', 'id_card')),
  full_legal_name  BYTEA       NOT NULL,
  document_number  BYTEA       NOT NULL,
  date_of_birth    BYTEA,
  nationality      TEXT,
  issuing_country  TEXT,
  expiry_date      DATE,
  notes            BYTEA,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, document_type)
);

ALTER TABLE public.user_travel_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER user_travel_documents_updated_at
  BEFORE UPDATE ON public.user_travel_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_user_travel_documents_user_id
  ON public.user_travel_documents (user_id);

-- RLS: owner can SELECT their own rows (safety net — real access via RPCs).
CREATE POLICY "travel_docs_select_own"
  ON public.user_travel_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Block all direct DML from the client. All writes go through SECURITY DEFINER RPCs.
CREATE POLICY "travel_docs_no_direct_insert"
  ON public.user_travel_documents
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "travel_docs_no_direct_update"
  ON public.user_travel_documents
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "travel_docs_no_direct_delete"
  ON public.user_travel_documents
  FOR DELETE TO authenticated
  USING (false);

-- ─── RPCs ──────────────────────────────────────────────────────────────────

-- upsert_travel_document: encrypts PII fields and inserts or updates the row.
-- ON CONFLICT on (user_id, document_type) means editing an existing document
-- replaces the encrypted values.
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

  IF length(p_full_legal_name) = 0 OR length(p_full_legal_name) > 200 THEN
    RAISE EXCEPTION 'full_legal_name must be 1–200 characters';
  END IF;

  IF length(p_document_number) = 0 OR length(p_document_number) > 50 THEN
    RAISE EXCEPTION 'document_number must be 1–50 characters';
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
    extensions.pgp_sym_encrypt(p_full_legal_name, v_key),
    extensions.pgp_sym_encrypt(p_document_number, v_key),
    CASE WHEN p_date_of_birth IS NOT NULL
         THEN extensions.pgp_sym_encrypt(p_date_of_birth, v_key) END,
    p_nationality,
    p_issuing_country,
    p_expiry_date,
    CASE WHEN p_notes IS NOT NULL
         THEN extensions.pgp_sym_encrypt(p_notes, v_key) END
  )
  ON CONFLICT (user_id, document_type) DO UPDATE SET
    full_legal_name  = extensions.pgp_sym_encrypt(p_full_legal_name, v_key),
    document_number  = extensions.pgp_sym_encrypt(p_document_number, v_key),
    date_of_birth    = CASE WHEN p_date_of_birth IS NOT NULL
                            THEN extensions.pgp_sym_encrypt(p_date_of_birth, v_key) END,
    nationality      = p_nationality,
    issuing_country  = p_issuing_country,
    expiry_date      = p_expiry_date,
    notes            = CASE WHEN p_notes IS NOT NULL
                            THEN extensions.pgp_sym_encrypt(p_notes, v_key) END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- get_my_travel_documents: decrypts and returns all documents for the caller.
CREATE OR REPLACE FUNCTION public.get_my_travel_documents()
RETURNS TABLE (
  id              UUID,
  document_type   TEXT,
  full_legal_name TEXT,
  document_number TEXT,
  date_of_birth   TEXT,
  nationality     TEXT,
  issuing_country TEXT,
  expiry_date     DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_key    TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_key := private.get_travel_doc_encryption_key();

  RETURN QUERY
  SELECT
    d.id,
    d.document_type,
    extensions.pgp_sym_decrypt(d.full_legal_name, v_key)   AS full_legal_name,
    extensions.pgp_sym_decrypt(d.document_number, v_key)   AS document_number,
    CASE WHEN d.date_of_birth IS NOT NULL
         THEN extensions.pgp_sym_decrypt(d.date_of_birth, v_key) END AS date_of_birth,
    d.nationality,
    d.issuing_country,
    d.expiry_date,
    CASE WHEN d.notes IS NOT NULL
         THEN extensions.pgp_sym_decrypt(d.notes, v_key) END AS notes,
    d.created_at,
    d.updated_at
  FROM public.user_travel_documents d
  WHERE d.user_id = v_caller
  ORDER BY d.document_type;
END;
$$;

-- delete_travel_document: deletes a document owned by the caller.
CREATE OR REPLACE FUNCTION public.delete_travel_document(p_document_id UUID)
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

  DELETE FROM public.user_travel_documents
  WHERE id = p_document_id AND user_id = v_caller;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or permission denied';
  END IF;
END;
$$;
