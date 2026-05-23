-- Batch push notification dispatch.
--
-- Problem: private.create_trip_notification loops over M trip members and does
-- M separate INSERTs into notifications. Each INSERT fires the per-row
-- trg_dispatch_push_notification trigger, which reads 2 vault secrets and calls
-- net.http_post — all inside the same write transaction. For a 9-member trip,
-- one activity creation executes 18 blocking vault reads before the transaction
-- commits, and spawns 9 separate Edge Function invocations.
--
-- Fix:
--   1. The per-row trigger checks a transaction-local flag. When the flag is set
--      it returns immediately (no vault reads, no HTTP call).
--   2. create_trip_notification sets the flag before the loop, collects all
--      (user_id, notification_id) pairs, resets the flag after the loop, then
--      reads the vault ONCE and makes ONE net.http_post with the full batch.
--   3. The Edge Function is updated separately to handle the batch payload
--      (batch SELECT for preferences and tokens, one Expo API call).
--
-- Net result: O(1) vault reads and O(1) HTTP calls per event regardless of group
-- size, down from O(M) each.
--
-- The per-row trigger still fires for any future direct INSERTs into notifications
-- that bypass create_trip_notification (e.g., if a new feature inserts a single
-- targeted notification). Those pay 2 vault reads × 1 row — acceptable.

----------------------------------------------------------------------
-- 1. UPDATE per-row trigger to skip when batch flag is set
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.dispatch_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge_fn_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Skip per-row dispatch when called from create_trip_notification.
  -- That function handles the batch dispatch itself after all INSERTs.
  IF current_setting('app.batch_push_pending', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_edge_fn_url'
  LIMIT 1;

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

----------------------------------------------------------------------
-- 2. REWRITE create_trip_notification — batch dispatch
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.create_trip_notification(
  p_trip_id         UUID,
  p_exclude_user_id UUID,
  p_type            TEXT,
  p_title           TEXT,
  p_body            TEXT    DEFAULT NULL,
  p_related_type    TEXT    DEFAULT NULL,
  p_related_id      UUID    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member           RECORD;
  v_notification_id  UUID;
  v_notification_ids UUID[]  := '{}';
  v_user_ids         UUID[]  := '{}';
  v_edge_fn_url      TEXT;
  v_service_key      TEXT;
BEGIN
  -- Signal the per-row trigger to skip — we dispatch in batch below.
  PERFORM set_config('app.batch_push_pending', 'true', true);

  FOR v_member IN
    SELECT user_id
    FROM public.trip_members
    WHERE trip_id = p_trip_id
      AND user_id != p_exclude_user_id
  LOOP
    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body, related_type, related_id
    ) VALUES (
      p_trip_id,
      v_member.user_id,
      p_type,
      p_title,
      p_body,
      p_related_type,
      p_related_id
    )
    RETURNING id INTO v_notification_id;

    v_notification_ids := v_notification_ids || v_notification_id;
    v_user_ids         := v_user_ids         || v_member.user_id;
  END LOOP;

  -- Reset flag before making the HTTP call so any nested triggers behave normally.
  PERFORM set_config('app.batch_push_pending', 'false', true);

  -- Nothing to dispatch if no members received a notification.
  IF array_length(v_notification_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Read vault once for the whole batch.
  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_edge_fn_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_service_role_key'
  LIMIT 1;

  IF v_edge_fn_url IS NULL OR v_service_key IS NULL THEN
    RETURN;
  END IF;

  -- One HTTP call for all recipients.
  PERFORM net.http_post(
    url     := v_edge_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'batch',           true,
      'trip_id',         p_trip_id,
      'type',            p_type,
      'title',           p_title,
      'body',            p_body,
      'related_type',    p_related_type,
      'related_id',      p_related_id,
      'notification_ids', v_notification_ids,
      'user_ids',         v_user_ids
    )
  );
END;
$$;
