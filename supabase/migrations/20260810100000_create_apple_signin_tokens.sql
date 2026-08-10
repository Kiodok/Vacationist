-- Phase: iOS Sign in with Apple — token revocation support (App Review Guideline 5.1.1(v))
--
-- Apple requires that when a user deletes their account, the app also revokes their Apple
-- Sign In token server-side. Revocation needs a refresh_token, which is only obtainable by
-- exchanging the native sign-in's authorizationCode at sign-in time (see the
-- apple-token-exchange Edge Function) — the authorizationCode itself is single-use and
-- unusable by the time of a later account deletion, so the resulting refresh_token must be
-- captured once and persisted until then.
--
-- No PostgREST-reachable client access whatsoever beyond the SECURITY DEFINER RPCs below,
-- called by the apple-token-exchange and revoke-apple-token Edge Functions using the caller's
-- own JWT (not the service role), so auth.uid() resolves to the real user in each RPC.
--
-- FK is ON DELETE CASCADE, so this table needs no entry in delete_own_account()'s
-- sentinel-reassignment list (see CLAUDE.md's Account Deletion section) — deleting
-- auth.users cascades to public.users, which cascades here. In practice the row is already
-- gone by then: useDeleteAccount.ts calls delete_own_apple_refresh_token() itself right after
-- a successful revocation, before deleteOwnAccount() ever runs.

CREATE TABLE public.user_apple_tokens (
  user_id                 UUID        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  encrypted_refresh_token BYTEA       NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_apple_tokens ENABLE ROW LEVEL SECURITY;

-- RLS: owner can SELECT their own row (safety net — real access via RPCs). No direct DML.
CREATE POLICY "apple_tokens_select_own"
  ON public.user_apple_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "apple_tokens_no_direct_insert"
  ON public.user_apple_tokens
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "apple_tokens_no_direct_update"
  ON public.user_apple_tokens
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "apple_tokens_no_direct_delete"
  ON public.user_apple_tokens
  FOR DELETE TO authenticated
  USING (false);

-- Dedicated vault secret (independent of travel_documents_encryption_key — this key protects
-- an OAuth credential, not user PII, and the two should be rotatable independently).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'apple_signin_token_encryption_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'apple_signin_token_encryption_key',
      'AES-256 key for encrypting Apple Sign In OAuth refresh tokens'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_apple_token_encryption_key()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'apple_signin_token_encryption_key'
  LIMIT 1;
$$;

-- Called once, immediately after a fresh native Apple sign-in that returned an
-- authorizationCode (apple-token-exchange Edge Function). Upsert: re-linking or re-authorizing
-- simply replaces the stored token.
CREATE OR REPLACE FUNCTION public.store_apple_refresh_token(p_refresh_token TEXT)
RETURNS VOID
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

  IF p_refresh_token IS NULL OR length(trim(p_refresh_token)) = 0 THEN
    RAISE EXCEPTION 'refresh_token is required';
  END IF;

  v_key := private.get_apple_token_encryption_key();
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  INSERT INTO public.user_apple_tokens (user_id, encrypted_refresh_token)
  VALUES (v_caller, extensions.pgp_sym_encrypt(p_refresh_token, v_key, 'cipher-algo=aes256'))
  ON CONFLICT (user_id) DO UPDATE SET
    encrypted_refresh_token = extensions.pgp_sym_encrypt(p_refresh_token, v_key, 'cipher-algo=aes256'),
    created_at = NOW();
END;
$$;

-- Called once, right before account deletion (revoke-apple-token Edge Function). Returns NULL
-- if the caller never linked Apple or the key isn't configured — the caller treats that as
-- "nothing to revoke", not an error.
CREATE OR REPLACE FUNCTION public.get_own_apple_refresh_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_key    TEXT;
  v_token  TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_key := private.get_apple_token_encryption_key();
  IF v_key IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT extensions.pgp_sym_decrypt(encrypted_refresh_token, v_key)
  INTO v_token
  FROM public.user_apple_tokens
  WHERE user_id = v_caller;

  RETURN v_token;
END;
$$;

-- Cleanup after a successful revocation (revoke-apple-token Edge Function) — called
-- proactively from the client before deleteOwnAccount() runs, ahead of the FK cascade.
CREATE OR REPLACE FUNCTION public.delete_own_apple_refresh_token()
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

  DELETE FROM public.user_apple_tokens WHERE user_id = v_caller;
END;
$$;
