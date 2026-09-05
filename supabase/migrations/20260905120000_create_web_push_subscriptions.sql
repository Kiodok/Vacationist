-- v1.34.0 item 1 — Phase 12: Web Push Notifications.
-- Browser push subscriptions, separate from user_push_tokens (Expo/native) to keep the schemas
-- clean — a browser subscription has no Expo push token, just an endpoint + encryption keys.

CREATE TABLE public.web_push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh_key  TEXT NOT NULL,
  auth_key    TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER web_push_subscriptions_updated_at
  BEFORE UPDATE ON public.web_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_web_push_subscriptions_user_id ON public.web_push_subscriptions(user_id);

-- SELECT: own subscriptions only.
CREATE POLICY "web_push_subscriptions_select_own"
  ON public.web_push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- INSERT/UPDATE: only via the SECURITY DEFINER RPCs below — a client writing raw endpoint/key
-- values directly would let anyone attach an arbitrary subscription to their own account without
-- the upsert's dedupe-on-(user_id, endpoint) guarantee (same "deny direct writes" pattern as any
-- other SECURITY DEFINER-only-write table in this codebase).
CREATE POLICY "web_push_subscriptions_insert_deny"
  ON public.web_push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "web_push_subscriptions_update_deny"
  ON public.web_push_subscriptions FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

-- DELETE: own subscriptions only — allows client-side unsubscribe (sign-out) without an RPC.
CREATE POLICY "web_push_subscriptions_delete_own"
  ON public.web_push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.upsert_web_push_subscription(
  p_endpoint TEXT,
  p_p256dh_key TEXT,
  p_auth_key TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.web_push_subscriptions (user_id, endpoint, p256dh_key, auth_key, user_agent)
  VALUES (auth.uid(), trim(p_endpoint), trim(p_p256dh_key), trim(p_auth_key), p_user_agent)
  ON CONFLICT (user_id, endpoint)
  DO UPDATE SET
    p256dh_key = EXCLUDED.p256dh_key,
    auth_key = EXCLUDED.auth_key,
    user_agent = EXCLUDED.user_agent,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_web_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.web_push_subscriptions
   WHERE user_id = auth.uid() AND endpoint = p_endpoint;
END;
$$;
