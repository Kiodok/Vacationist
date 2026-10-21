-- Security fix: create-example-trip is deployed with --no-verify-jwt and the
-- Edge Function itself performed no caller authentication at all, trusting a
-- client-supplied user_id -- any internet caller could POST an arbitrary
-- user_id and seed a full demo trip (with fake chat messages/expenses) onto
-- a victim's account. Add a shared-secret Authorization header, mirroring
-- private.trigger_fetch_exchange_rates() (20260809100008) and the
-- push-notification function's own pattern, and require it inside the
-- Edge Function itself (supabase/functions/create-example-trip/index.ts,
-- same commit).
--
-- Manual step required in BOTH dev and prod, before/alongside this
-- migration (secret VALUES never belong in a migration file, matching how
-- push_notification_service_role_key / fetch_exchange_rates_secret were
-- seeded -- see engineering/supabase.md):
--   SELECT vault.create_secret('<random-value>', 'example_trip_secret');
--   supabase secrets set CREATE_EXAMPLE_TRIP_SECRET=<same-value>
-- Dev and prod must use DIFFERENT secret values, per house convention.
--
-- Rollout order per environment (avoids any gap in demo-trip seeding):
-- create the vault secret + Edge Function secret -> push this migration
-- (trigger now sends the header; the still-old Edge Function version
-- ignores it harmlessly) -> redeploy the Edge Function (now enforces it).

CREATE OR REPLACE FUNCTION private.trigger_create_example_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge_fn_url TEXT;
  v_secret      TEXT;
BEGIN
  IF NEW.is_guest = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'example_trip_fn_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'example_trip_secret'
  LIMIT 1;

  IF v_edge_fn_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object('user_id', NEW.id)
  );

  RETURN NEW;
END;
$$;
