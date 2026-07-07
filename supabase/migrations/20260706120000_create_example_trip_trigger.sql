-- After a new (non-guest) user row is created, fire the create-example-trip Edge Function
-- so the user lands in the app with a pre-populated demo trip.
--
-- Uses two vault secrets (same pattern as push-notification):
--   example_trip_fn_url          – full URL of the create-example-trip Edge Function
--   example_trip_service_role_key – service-role JWT for the project
--
-- The call is fire-and-forget via pg_net at transaction depth 0.
-- Guests are skipped; the function itself also guards against duplicate trips.

----------------------------------------------------------------------
-- 1. TRIGGER FUNCTION
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.trigger_create_example_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge_fn_url  TEXT;
  v_service_key  TEXT;
BEGIN
  -- Skip guest users — they joined via an invite and don't need an example trip
  IF NEW.is_guest = TRUE THEN
    RETURN NEW;
  END IF;

  -- Read vault secrets (silently skip if not configured)
  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'example_trip_fn_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'example_trip_service_role_key'
  LIMIT 1;

  IF v_edge_fn_url IS NULL OR v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- pg_net fire-and-forget (depth 0 from AFTER INSERT on users is fine)
  PERFORM net.http_post(
    url     := v_edge_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object('user_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 2. TRIGGER
----------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_create_example_trip ON public.users;

CREATE TRIGGER trg_create_example_trip
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION private.trigger_create_example_trip();
