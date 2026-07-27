-- Phase: Chat Encryption — Security Fix 2/3
--
-- trip_messages_insert_member and trip_messages_update_owner (from
-- 20260716100000_create_trip_messages.sql) still let any authenticated trip member
-- write directly to trip_messages via PostgREST/supabase-js, bypassing the
-- create_trip_message / update_trip_message RPCs entirely. Since RLS — not "the app
-- only calls the RPC" — is the actual trust boundary (see engineering/software_
-- engineering_guide.md Section 15), any trip member could insert or update the
-- "encrypted" text column with raw, un-encrypted bytes, and any other trip member's
-- direct SELECT would then read that column back as plaintext with no key needed.
-- This defeats the AES encryption added in 20260719100000_encrypt_trip_messages.sql.
--
-- Fix: replace both policies with deny-all, exactly mirroring the pattern already
-- used for user_travel_documents (20260525000002_create_user_travel_documents.sql).
-- All writes now go exclusively through the SECURITY DEFINER RPCs. Verified safe:
-- packages/api/src/messages.ts has zero direct `.from('trip_messages')` writes, and
-- every chat mutation (create/update/delete) already routes through create_trip_message
-- / update_trip_message / soft_delete_trip_message, which run as SECURITY DEFINER and
-- are unaffected by RLS.
--
-- The SELECT policy (trip_messages_select_member) is untouched — Realtime delivery
-- depends on it and it was never the problem (it returns ciphertext, not plaintext).

----------------------------------------------------------------------
-- 1. DENY DIRECT INSERT / UPDATE
----------------------------------------------------------------------

DROP POLICY IF EXISTS "trip_messages_insert_member" ON public.trip_messages;
DROP POLICY IF EXISTS "trip_messages_update_owner"  ON public.trip_messages;

CREATE POLICY "trip_messages_no_direct_insert"
  ON public.trip_messages
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "trip_messages_no_direct_update"
  ON public.trip_messages
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

----------------------------------------------------------------------
-- 2. seed_trip_message: service-role-only RPC for the create-example-trip Edge
--    Function. create_trip_message cannot be reused for seeding — it reads
--    auth.uid(), which is NULL under the service_role key the Edge Function uses.
--    Deliberately has no auth.uid()/membership check (there is no caller session to
--    check); it is locked down by REVOKE/GRANT instead, same pattern as
--    get_chat_push_preview in 20260727100000_chat_notification_no_plaintext.sql.
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
  VALUES (p_trip_id, p_user_id, extensions.pgp_sym_encrypt(btrim(p_text), v_key))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_trip_message(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_trip_message(UUID, UUID, TEXT) TO service_role;
