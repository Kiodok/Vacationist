-- Phase: iOS Sign in with Apple — fix silent NULL ambiguity in get_own_apple_refresh_token()
--
-- 20260810100000's get_own_apple_refresh_token() returned NULL both when the caller never
-- linked Apple (no row) AND when the encryption key was unavailable (vault secret missing/
-- rotated) — revoke-apple-token's Edge Function couldn't tell these apart, so a key outage
-- would silently produce 204s with zero signal that Guideline 5.1.1(v) revocation was failing
-- for every Apple-linked user deleting their account.
--
-- Fix: RAISE EXCEPTION when the key is unavailable (a real operational fault) instead of
-- returning NULL. The Edge Function's existing rpcError-vs-null-data branching (added in the
-- original pass, unchanged here) already treats an RPC error as a logged 500 and a null value
-- as a clean "nothing to revoke" 204 — this migration is the only piece needed to make that
-- distinction actually meaningful.

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
    RAISE EXCEPTION 'Apple token encryption key not configured';
  END IF;

  SELECT extensions.pgp_sym_decrypt(encrypted_refresh_token, v_key)
  INTO v_token
  FROM public.user_apple_tokens
  WHERE user_id = v_caller;

  RETURN v_token;
END;
$$;
