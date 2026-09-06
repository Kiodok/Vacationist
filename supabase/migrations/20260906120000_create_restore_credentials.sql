-- Phase: 17 — Zero-Tap Sign-In (Android Restore Credentials API)
--
-- Google Play's "Zero-Tap Sign-In" technical-quality requirement (enforced April 2027) requires
-- any app with sign-in to restore the signed-in state when the user migrates to a new Android
-- device. The mechanism is the Android Restore Credentials API, which is WebAuthn under the hood:
-- a device-bound key pair whose private half rides Google's end-to-end-encrypted backup / D2D
-- transfer channel and whose public half must be verified server-side.
--
-- This migration adds:
--   public.restore_credentials             — one WebAuthn credential per user (public key only)
--   public.restore_credential_challenges   — short-lived, single-use server challenges
--   private.prune_restore_credential_challenges() + a daily pg_cron job
--
-- Both tables are written to EXCLUSIVELY by the `restore-credential` Edge Function using the
-- service key. RLS denies every client role outright — same posture as public.analytics_events
-- (20260808100000). There is no SECURITY DEFINER RPC because the unauthenticated half of the
-- flow (a brand-new device with no session) could not call one anyway.
--
-- delete_own_account(): NO companion change needed. restore_credentials.user_id is
-- ON DELETE CASCADE, and restore_credential_challenges.user_id is nullable ON DELETE SET NULL.
-- Verified against pg_constraint after applying (see engineering/supabase.md) — both resolve
-- themselves on user delete, unlike the trip_messages gap fixed 2026-07-27.

----------------------------------------------------------------------
-- 1. TABLE — public.restore_credentials
----------------------------------------------------------------------

CREATE TABLE public.restore_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- base64url WebAuthn credential id, as issued by Credential Manager on the device
  credential_id TEXT NOT NULL UNIQUE CHECK (char_length(credential_id) <= 1024),
  -- base64url of the COSE-encoded public key extracted from the attestation object
  public_key    TEXT NOT NULL CHECK (char_length(public_key) <= 2048),
  -- WebAuthn signature counter — replay-attack guard, monotonically non-decreasing
  sign_count    BIGINT NOT NULL DEFAULT 0,
  aaguid        TEXT CHECK (aaguid IS NULL OR char_length(aaguid) <= 64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);

-- One restore credential per user is the norm, but the table is not UNIQUE(user_id): a user who
-- re-registers on a second device before the first row is cleared would otherwise fail. The
-- Edge Function replaces any existing row for the user on register-verify.
CREATE INDEX idx_restore_credentials_user_id ON public.restore_credentials (user_id);

ALTER TABLE public.restore_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restore_credentials_no_direct_select"
  ON public.restore_credentials
  FOR SELECT TO anon, authenticated
  USING (false);

CREATE POLICY "restore_credentials_no_direct_insert"
  ON public.restore_credentials
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "restore_credentials_no_direct_update"
  ON public.restore_credentials
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "restore_credentials_no_direct_delete"
  ON public.restore_credentials
  FOR DELETE TO anon, authenticated
  USING (false);

----------------------------------------------------------------------
-- 2. TABLE — public.restore_credential_challenges
----------------------------------------------------------------------

CREATE TABLE public.restore_credential_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- base64url random challenge echoed back inside clientDataJSON
  challenge  TEXT NOT NULL CHECK (char_length(challenge) <= 512),
  -- set for 'register' (the authenticated caller), NULL for 'authenticate' (no session yet)
  user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Challenge lookup is by value; the expires_at index serves the prune job.
CREATE UNIQUE INDEX idx_restore_challenges_challenge
  ON public.restore_credential_challenges (challenge);
CREATE INDEX idx_restore_challenges_expires_at
  ON public.restore_credential_challenges (expires_at);

ALTER TABLE public.restore_credential_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restore_challenges_no_direct_select"
  ON public.restore_credential_challenges
  FOR SELECT TO anon, authenticated
  USING (false);

CREATE POLICY "restore_challenges_no_direct_insert"
  ON public.restore_credential_challenges
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "restore_challenges_no_direct_update"
  ON public.restore_credential_challenges
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "restore_challenges_no_direct_delete"
  ON public.restore_credential_challenges
  FOR DELETE TO anon, authenticated
  USING (false);

----------------------------------------------------------------------
-- 3. private.prune_restore_credential_challenges() + daily cron
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.prune_restore_credential_challenges()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Challenges are single-use (deleted by the Edge Function on consumption) and 2-minute TTL;
  -- this only sweeps ones that were issued but never completed.
  DELETE FROM public.restore_credential_challenges
  WHERE expires_at < NOW() - INTERVAL '1 day';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'prune-restore-credential-challenges';

SELECT cron.schedule(
  'prune-restore-credential-challenges',
  '15 3 * * *',
  $$SELECT private.prune_restore_credential_challenges()$$
);
