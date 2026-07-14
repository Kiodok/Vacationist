-- Fix: column reference "trip_id" is ambiguous (code 42702)
--
-- In PL/pgSQL functions that declare RETURNS TABLE (..., trip_id UUID, ...),
-- an unqualified "trip_id" in a WHERE clause is ambiguous between the output
-- column variable and the table column. Fix: alias the table and qualify.
--
-- Affected: create_trip_message, get_trip_messages, get_trip_message_by_id.

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

  INSERT INTO public.trip_messages (trip_id, created_by, text)
  VALUES (p_trip_id, v_caller, extensions.pgp_sym_encrypt(btrim(p_text), v_key))
  RETURNING id INTO v_id;

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

CREATE OR REPLACE FUNCTION public.get_trip_messages(
  p_trip_id UUID,
  p_cursor  TIMESTAMPTZ DEFAULT NULL,
  p_limit   INT         DEFAULT 50
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
STABLE
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_key    TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members tm
    WHERE tm.trip_id = p_trip_id AND tm.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  v_key := private.get_chat_encryption_key();

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
  WHERE m.trip_id = p_trip_id
    AND m.deleted_at IS NULL
    AND (p_cursor IS NULL OR m.created_at < p_cursor)
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trip_message_by_id(
  p_message_id UUID
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
STABLE
AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_trip_id UUID;
  v_key     TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.trip_id INTO v_trip_id
  FROM public.trip_messages m
  WHERE m.id = p_message_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members tm
    WHERE tm.trip_id = v_trip_id AND tm.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  v_key := private.get_chat_encryption_key();

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
