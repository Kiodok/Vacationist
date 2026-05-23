-- Phase 8: Notifications
-- Migration 5: pg_net extension + vault secrets + push dispatch trigger

----------------------------------------------------------------------
-- 1. ENABLE pg_net
-- On Supabase hosted projects, pg_net is pre-installed in the net schema.
-- This is a no-op if already installed.
----------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net;

----------------------------------------------------------------------
-- 2. VAULT SECRETS
-- These are populated after the Edge Function is deployed.
-- The trigger function reads them at runtime; missing secrets are a
-- no-op (push is skipped silently — in-app notification still exists).
-- To populate after deployment:
--   SELECT vault.create_secret('<edge-fn-url>', 'push_notification_edge_fn_url');
--   SELECT vault.create_secret('<service-role-key>', 'push_notification_service_role_key');
----------------------------------------------------------------------

----------------------------------------------------------------------
-- 3. DISPATCH TRIGGER FUNCTION
-- Fires AFTER INSERT on notifications and calls the Edge Function via
-- pg_net (non-blocking / fire-and-forget). The Edge Function handles
-- preference checking, token lookup, and Expo Push API delivery.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.dispatch_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge_fn_url    TEXT;
  v_service_key    TEXT;
BEGIN
  -- Read configuration from vault (no-op if secrets not set)
  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_edge_fn_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_service_role_key'
  LIMIT 1;

  -- If either secret is missing, skip push (in-app notification still exists)
  IF v_edge_fn_url IS NULL OR v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP POST to Edge Function
  PERFORM net.http_post(
    url     := v_edge_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'notification_id', NEW.id,
      'trip_id',         NEW.trip_id,
      'user_id',         NEW.user_id,
      'type',            NEW.type,
      'title',           NEW.title,
      'body',            NEW.body,
      'related_type',    NEW.related_type,
      'related_id',      NEW.related_id
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dispatch_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION private.dispatch_push_notification();
