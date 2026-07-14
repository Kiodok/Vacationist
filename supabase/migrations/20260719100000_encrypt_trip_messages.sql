-- Phase: Chat Encryption
--
-- Encrypts the trip_messages.text column at rest using AES-256 (pgp_sym_encrypt).
-- Pattern mirrors user_travel_documents encryption (20260525000001/20260525000002).
--
-- Changes:
--   1. Vault secret: trip_messages_encryption_key
--   2. Private helper: private.get_chat_encryption_key()
--   3. text column: TEXT → BYTEA, existing rows encrypted in-place
--   4. CHECK constraint replaced with RPC-level validation
--   5. RPCs: create_trip_message, update_trip_message, get_trip_messages,
--            get_trip_message_by_id (for realtime decryption after insert/update)
--   6. Notification trigger updated to decrypt text for notification body

----------------------------------------------------------------------
-- 1. VAULT SECRET
----------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'trip_messages_encryption_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'trip_messages_encryption_key',
      'AES-256 key for encrypting trip chat messages'
    );
  END IF;
END;
$$;

----------------------------------------------------------------------
-- 2. PRIVATE HELPER
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.get_chat_encryption_key()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'trip_messages_encryption_key'
  LIMIT 1;
$$;

----------------------------------------------------------------------
-- 3. COLUMN CHANGE: text TEXT → BYTEA
----------------------------------------------------------------------

-- Drop existing CHECK constraint (references char_length which doesn't work on BYTEA).
ALTER TABLE public.trip_messages DROP CONSTRAINT IF EXISTS trip_messages_text_check;

-- Encrypt all existing plain-text messages in-place.
-- Uses a DO block so the key fetch happens once, not per row.
DO $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := private.get_chat_encryption_key();
  UPDATE public.trip_messages
     SET text = extensions.pgp_sym_encrypt(text::TEXT, v_key)
   WHERE deleted_at IS NULL OR deleted_at IS NOT NULL; -- all rows
END;
$$;

-- Change column type. Existing BYTEA values from the UPDATE above are preserved.
ALTER TABLE public.trip_messages
  ALTER COLUMN text TYPE BYTEA USING text::BYTEA;

----------------------------------------------------------------------
-- 4. RPCs
----------------------------------------------------------------------

-- create_trip_message: validates, encrypts, inserts, returns decrypted row + sender.
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
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id AND user_id = v_caller
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

-- update_trip_message: validates, encrypts, updates, returns decrypted row + sender.
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
     SET text = extensions.pgp_sym_encrypt(btrim(p_text), v_key)
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

-- get_trip_messages: decrypts, paginates (keyset), returns with sender.
-- p_cursor is a created_at TIMESTAMPTZ string for keyset pagination (exclusive upper bound).
-- p_limit defaults to 50.
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
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id AND user_id = v_caller
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

-- get_trip_message_by_id: fetches and decrypts a single message.
-- Used by the realtime handler after INSERT/UPDATE to hydrate the cache.
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

  -- Verify caller is a member of the trip this message belongs to.
  SELECT m.trip_id INTO v_trip_id
  FROM public.trip_messages m
  WHERE m.id = p_message_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = v_trip_id AND user_id = v_caller
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

----------------------------------------------------------------------
-- 5. UPDATE NOTIFICATION TRIGGER
-- notify_on_new_chat_message reads NEW.text for the notification body.
-- After encryption NEW.text is BYTEA — decrypt it before passing to the helper.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_on_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_sender_name  TEXT;
  v_trip_title   TEXT;
  v_plain_text   TEXT;
BEGIN
  SELECT name INTO v_sender_name FROM public.users WHERE id = NEW.created_by;
  SELECT title INTO v_trip_title FROM public.trips WHERE id = NEW.trip_id AND deleted_at IS NULL;

  IF v_trip_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- Decrypt the message text for the notification body preview.
  v_plain_text := extensions.pgp_sym_decrypt(NEW.text, private.get_chat_encryption_key());

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.created_by,
    'new_chat_message',
    'New chat message',
    NULL,
    'trip_message',
    NEW.id,
    LEFT(v_plain_text, 200),
    v_trip_title,
    v_sender_name
  );

  RETURN NEW;
END;
$$;
