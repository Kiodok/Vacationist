-- Update trigger to reuse the existing push_notification_service_role_key vault secret
-- instead of requiring a separate example_trip_service_role_key. The key is identical —
-- it's the project service role key — so there's no reason to store it twice.
-- Only vault secret needed: example_trip_fn_url.

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
  IF NEW.is_guest = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'example_trip_fn_url'
  LIMIT 1;

  -- Reuse the same service role key already stored for the push-notification function
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_service_role_key'
  LIMIT 1;

  IF v_edge_fn_url IS NULL OR v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

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
