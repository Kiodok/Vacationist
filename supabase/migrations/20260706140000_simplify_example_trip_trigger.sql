-- create-example-trip is deployed with --no-verify-jwt so no Authorization
-- header is required. Simplify the trigger: only the URL vault secret is needed.

CREATE OR REPLACE FUNCTION private.trigger_create_example_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge_fn_url TEXT;
BEGIN
  IF NEW.is_guest = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'example_trip_fn_url'
  LIMIT 1;

  IF v_edge_fn_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('user_id', NEW.id)
  );

  RETURN NEW;
END;
$$;
