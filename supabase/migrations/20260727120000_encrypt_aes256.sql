-- Phase: Chat Encryption — Security Fix 3/3
--
-- Every pgp_sym_encrypt() call in the codebase (travel documents and chat messages)
-- was made with no `options` argument. pgcrypto defaults `cipher-algo` to aes128 when
-- none is supplied — every comment, migration note, and engineering/software_
-- engineering_guide.md Section 14 claim "AES-256 column encryption", but the actual
-- cipher in use has been AES-128 since inception. AES-128 is not broken, but the
-- documented/claimed security control does not match the implementation.
--
-- Fix: recreate every encrypting function with 'cipher-algo=aes256' as the third
-- pgp_sym_encrypt() argument, and re-encrypt all existing rows so the AES-256 claim
-- is true retroactively, not just for rows written after this migration.
--
-- pgp_sym_decrypt() reads the cipher algorithm from the PGP packet header, so AES-128
-- and AES-256 rows decrypt identically — no coordinated deploy or downtime is needed;
-- this migration is safe to apply while the app is live.

----------------------------------------------------------------------
-- 1. upsert_travel_document — recreate with cipher-algo=aes256
--    (body copied forward from 20260525000004_security_fixes.sql, encrypt calls only)
----------------------------------------------------------------------

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
    extensions.pgp_sym_encrypt(trim(p_full_legal_name), v_key, 'cipher-algo=aes256'),
    extensions.pgp_sym_encrypt(trim(p_document_number), v_key, 'cipher-algo=aes256'),
    CASE WHEN p_date_of_birth IS NOT NULL
         THEN extensions.pgp_sym_encrypt(p_date_of_birth, v_key, 'cipher-algo=aes256') END,
    p_nationality,
    p_issuing_country,
    p_expiry_date,
    CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
         THEN extensions.pgp_sym_encrypt(trim(p_notes), v_key, 'cipher-algo=aes256') END
  )
  ON CONFLICT (user_id, document_type) DO UPDATE SET
    full_legal_name  = extensions.pgp_sym_encrypt(trim(p_full_legal_name), v_key, 'cipher-algo=aes256'),
    document_number  = extensions.pgp_sym_encrypt(trim(p_document_number), v_key, 'cipher-algo=aes256'),
    date_of_birth    = CASE WHEN p_date_of_birth IS NOT NULL
                            THEN extensions.pgp_sym_encrypt(p_date_of_birth, v_key, 'cipher-algo=aes256') END,
    nationality      = p_nationality,
    issuing_country  = p_issuing_country,
    expiry_date      = p_expiry_date,
    notes            = CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
                            THEN extensions.pgp_sym_encrypt(trim(p_notes), v_key, 'cipher-algo=aes256') END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

----------------------------------------------------------------------
-- 2. create_trip_message — recreate with cipher-algo=aes256
--    (body copied forward from 20260719120000_fix_ambiguous_id_in_create_trip_message.sql)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_trip_message(
  p_trip_id UUID,
  p_text    TEXT
)
RETURNS TABLE (
  id         UUID,
  trip_id    UUID,
  created_by UUID,
  text       TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  sender     JSON
)
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

  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(p_text) > 2000 THEN
    RAISE EXCEPTION 'Message exceeds 2000 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members tm
    WHERE tm.trip_id = p_trip_id AND tm.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  v_key := private.get_chat_encryption_key();

  -- Alias the target table so RETURNING can qualify columns unambiguously
  -- (bare "id" would collide with the RETURNS TABLE output variable).
  INSERT INTO public.trip_messages AS ins (trip_id, created_by, text)
  VALUES (p_trip_id, v_caller, extensions.pgp_sym_encrypt(btrim(p_text), v_key, 'cipher-algo=aes256'))
  RETURNING ins.id INTO v_id;

  RETURN QUERY
  SELECT
    m.id,
    m.trip_id,
    m.created_by,
    extensions.pgp_sym_decrypt(m.text, v_key) AS text,
    m.created_at,
    m.updated_at,
    m.deleted_at,
    json_build_object('name', u.name, 'avatar_url', u.avatar_url) AS sender
  FROM public.trip_messages m
  JOIN public.users u ON u.id = m.created_by
  WHERE m.id = v_id;
END;
$$;

----------------------------------------------------------------------
-- 3. update_trip_message — recreate with cipher-algo=aes256
--    (body copied forward from 20260719100000_encrypt_trip_messages.sql)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_trip_message(
  p_message_id UUID,
  p_text       TEXT
)
RETURNS TABLE (
  id         UUID,
  trip_id    UUID,
  created_by UUID,
  text       TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  sender     JSON
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

  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(p_text) > 2000 THEN
    RAISE EXCEPTION 'Message exceeds 2000 characters';
  END IF;

  v_key := private.get_chat_encryption_key();

  UPDATE public.trip_messages
     SET text = extensions.pgp_sym_encrypt(btrim(p_text), v_key, 'cipher-algo=aes256')
   WHERE id = p_message_id
     AND created_by = v_caller
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or permission denied';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.trip_id,
    m.created_by,
    extensions.pgp_sym_decrypt(m.text, v_key) AS text,
    m.created_at,
    m.updated_at,
    m.deleted_at,
    json_build_object('name', u.name, 'avatar_url', u.avatar_url) AS sender
  FROM public.trip_messages m
  JOIN public.users u ON u.id = m.created_by
  WHERE m.id = p_message_id;
END;
$$;

----------------------------------------------------------------------
-- 4. seed_trip_message — recreate with cipher-algo=aes256
--    (body copied forward from 20260727110000_lock_down_trip_messages_rls.sql)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_trip_message(
  p_trip_id UUID,
  p_user_id UUID,
  p_text    TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_key TEXT;
  v_id  UUID;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(p_text) > 2000 THEN
    RAISE EXCEPTION 'Message exceeds 2000 characters';
  END IF;

  v_key := private.get_chat_encryption_key();

  INSERT INTO public.trip_messages (trip_id, created_by, text)
  VALUES (p_trip_id, p_user_id, extensions.pgp_sym_encrypt(btrim(p_text), v_key, 'cipher-algo=aes256'))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

----------------------------------------------------------------------
-- 5. RE-ENCRYPT EXISTING ROWS with AES-256, so the claim is retroactively true.
--    pgp_sym_decrypt() auto-detects the algorithm from the packet header, so this is
--    a straightforward decrypt-then-re-encrypt. Triggers that would rewrite
--    updated_at are disabled for the duration so this backfill is invisible as an
--    "edit" to end users (on_trip_message_update_restrict stays enabled — it only
--    guards trip_id/created_by/created_at, none of which this touches; the INSERT-only
--    notify_new_chat_message trigger is not fired by UPDATE at all).
----------------------------------------------------------------------

ALTER TABLE public.user_travel_documents DISABLE TRIGGER user_travel_documents_updated_at;

DO $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := private.get_travel_doc_encryption_key();

  UPDATE public.user_travel_documents SET
    full_legal_name = extensions.pgp_sym_encrypt(
      extensions.pgp_sym_decrypt(full_legal_name, v_key), v_key, 'cipher-algo=aes256'),
    document_number = extensions.pgp_sym_encrypt(
      extensions.pgp_sym_decrypt(document_number, v_key), v_key, 'cipher-algo=aes256'),
    date_of_birth = CASE WHEN date_of_birth IS NOT NULL THEN extensions.pgp_sym_encrypt(
      extensions.pgp_sym_decrypt(date_of_birth, v_key), v_key, 'cipher-algo=aes256') END,
    notes = CASE WHEN notes IS NOT NULL THEN extensions.pgp_sym_encrypt(
      extensions.pgp_sym_decrypt(notes, v_key), v_key, 'cipher-algo=aes256') END;
END;
$$;

ALTER TABLE public.user_travel_documents ENABLE TRIGGER user_travel_documents_updated_at;

ALTER TABLE public.trip_messages DISABLE TRIGGER trip_messages_updated_at;

DO $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := private.get_chat_encryption_key();

  UPDATE public.trip_messages SET
    text = extensions.pgp_sym_encrypt(
      extensions.pgp_sym_decrypt(text, v_key), v_key, 'cipher-algo=aes256');
END;
$$;

ALTER TABLE public.trip_messages ENABLE TRIGGER trip_messages_updated_at;
