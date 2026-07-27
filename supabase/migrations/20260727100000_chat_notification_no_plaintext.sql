-- Phase: Chat Encryption — Security Fix 1/3
--
-- notify_on_new_chat_message() was decrypting every new chat message and storing the
-- first 200 chars in public.notifications.context_entity (plain TEXT, no retention job,
-- broadcast via Realtime with REPLICA IDENTITY FULL). This completely defeated the
-- AES encryption added to trip_messages.text in 20260719100000_encrypt_trip_messages.sql.
--
-- Fix: stop writing message content into notifications at all. context_entity becomes
-- NULL for new_chat_message notifications going forward. Push previews are decrypted
-- on demand, at send time, by the push Edge Function via a new service-role-only RPC
-- (get_chat_push_preview) — nothing sensitive is ever persisted in a plaintext column.
--
-- Also purges the plaintext already written to existing rows.

----------------------------------------------------------------------
-- 1. STOP WRITING PLAINTEXT: notify_on_new_chat_message no longer decrypts NEW.text
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_on_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_sender_name  TEXT;
  v_trip_title   TEXT;
BEGIN
  SELECT name INTO v_sender_name FROM public.users WHERE id = NEW.created_by;
  SELECT title INTO v_trip_title FROM public.trips WHERE id = NEW.trip_id AND deleted_at IS NULL;

  IF v_trip_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- p_context_entity is intentionally NULL: chat message content must never be
  -- decrypted into a plaintext column. The push Edge Function fetches a preview
  -- on demand via get_chat_push_preview() at send time; the in-app notification
  -- center renders a generic "{{creator}} sent a message" body.
  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.created_by,
    'new_chat_message',
    'New chat message',
    NULL,
    'trip_message',
    NEW.id,
    NULL,
    v_trip_title,
    v_sender_name
  );

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 2. PURGE ALREADY-LEAKED PLAINTEXT from existing notification rows
----------------------------------------------------------------------

UPDATE public.notifications
   SET context_entity = NULL
 WHERE type = 'new_chat_message'
   AND context_entity IS NOT NULL;

----------------------------------------------------------------------
-- 3. get_chat_push_preview: on-demand decryption for the push Edge Function only.
--    Deliberately has NO auth.uid()/membership check — members already have a
--    membership-checked read path (get_trip_message_by_id). This RPC skips that
--    check on purpose and is locked down by REVOKE/GRANT instead, since it is
--    only ever called by the push Edge Function using the service_role key.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_chat_push_preview(p_message_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
DECLARE
  v_key  TEXT;
  v_text BYTEA;
  v_deleted_at TIMESTAMPTZ;
BEGIN
  SELECT m.text, m.deleted_at
    INTO v_text, v_deleted_at
    FROM public.trip_messages m
   WHERE m.id = p_message_id;

  IF v_text IS NULL OR v_deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  v_key := private.get_chat_encryption_key();

  RETURN LEFT(extensions.pgp_sym_decrypt(v_text, v_key), 200);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_chat_push_preview(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_push_preview(UUID) TO service_role;
