-- Phase 8: Notifications
-- Migration 1: user_push_tokens table, RLS, and RPCs for push token management

----------------------------------------------------------------------
-- 1. TABLE
----------------------------------------------------------------------
CREATE TABLE public.user_push_tokens (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  push_token   TEXT        NOT NULL,
  platform     TEXT        NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, push_token)
);

----------------------------------------------------------------------
-- 2. UPDATED_AT TRIGGER
----------------------------------------------------------------------
CREATE TRIGGER set_user_push_tokens_updated_at
  BEFORE UPDATE ON public.user_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

----------------------------------------------------------------------
-- 3. RLS
----------------------------------------------------------------------
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_push_tokens_select_own"
  ON public.user_push_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_push_tokens_insert_own"
  ON public.user_push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_push_tokens_update_own"
  ON public.user_push_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_push_tokens_delete_own"
  ON public.user_push_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

----------------------------------------------------------------------
-- 4. RPCS
----------------------------------------------------------------------

-- Upserts a push token for the current user (device registration on app start)
CREATE OR REPLACE FUNCTION public.upsert_push_token(
  p_push_token TEXT,
  p_platform   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_platform NOT IN ('ios', 'android') THEN
    RAISE EXCEPTION 'Invalid platform: %', p_platform;
  END IF;

  IF p_push_token IS NULL OR length(trim(p_push_token)) = 0 THEN
    RAISE EXCEPTION 'push_token is required';
  END IF;

  INSERT INTO public.user_push_tokens (user_id, push_token, platform)
  VALUES (v_caller, trim(p_push_token), p_platform)
  ON CONFLICT (user_id, push_token)
  DO UPDATE SET
    platform   = EXCLUDED.platform,
    updated_at = NOW();
END;
$$;

-- Removes a specific push token (called on logout or token refresh)
CREATE OR REPLACE FUNCTION public.delete_push_token(
  p_push_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.user_push_tokens
  WHERE user_id = v_caller
    AND push_token = trim(p_push_token);
END;
$$;

----------------------------------------------------------------------
-- 5. INDEXES
----------------------------------------------------------------------
CREATE INDEX idx_user_push_tokens_user_id ON public.user_push_tokens (user_id);
