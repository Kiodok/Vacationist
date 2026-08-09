-- private.create_trip_notification(): replace the per-row FOR loop over
-- trip_members with a single set-based INSERT ... SELECT.
--
-- Why: every AFTER INSERT/UPDATE trigger that fans a notification out to a
-- trip (new_activity, expense_change, new_member, vote_finalized,
-- schedule_change, member_left, etc.) calls this function synchronously
-- inside the SAME transaction as the write that triggered it. The previous
-- version looped trip_members and issued one INSERT ... RETURNING per
-- recipient — M sequential single-row inserts, adding latency to ordinary
-- writes (creating an activity, adding an expense) that scaled linearly with
-- trip size. A set-based INSERT is a single statement regardless of how many
-- members are in the trip.
--
-- Invariants preserved exactly from the previous version
-- (20260611172912_fix_create_trip_notification_overload.sql):
--   1. Array alignment: v_notification_ids[i] <-> v_user_ids[i] must stay
--      positionally aligned — the push-notification edge function maps each
--      Expo push message back to its notification row via this pairing
--      (see handleBatch() in supabase/functions/push-notification/index.ts).
--      A set-based RETURNING does not guarantee row order, so both arrays
--      are built from ONE ordered aggregation (array_agg(... ORDER BY
--      user_id)) over the same INSERT's returned rows, so they can never
--      drift apart.
--   2. The app.batch_push_pending transaction-local GUC is still set 'true'
--      before and 'false' after the insert — trg_dispatch_push_notification
--      (the per-row AFTER INSERT trigger on public.notifications) still
--      fires once per row even on a set-based insert; this GUC is what
--      suppresses its per-row HTTP dispatch so this function's own batched
--      dispatch below is the only one that actually fires.
--   3. `tm.user_id != p_exclude_user_id` (not IS DISTINCT FROM) is
--      unchanged — every caller passes the all-zeros sentinel UUID to mean
--      "notify everyone", never NULL, so this is intentionally exclusionary
--      of NULL exclude values exactly as before.
--   4. The three early exits, in the same order: no recipients -> return;
--      pg_trigger_depth() >= 1 (running inside a trigger) -> return and let
--      the pg_cron poller (dispatch_pending_push_notifications) pick the
--      rows up; either vault secret missing -> return.
--
-- Signature and callers are unchanged (~19 call sites across triggers, RPCs,
-- and pg_cron jobs) — only the function body changes.

CREATE OR REPLACE FUNCTION private.create_trip_notification(
  p_trip_id          UUID,
  p_exclude_user_id  UUID,
  p_type             TEXT,
  p_title            TEXT,
  p_body             TEXT     DEFAULT NULL,
  p_related_type     TEXT     DEFAULT NULL,
  p_related_id       UUID     DEFAULT NULL,
  p_context_entity   TEXT     DEFAULT NULL,
  p_context_trip     TEXT     DEFAULT NULL,
  p_context_creator  TEXT     DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_notification_ids UUID[];
  v_user_ids         UUID[];
  v_edge_fn_url      TEXT;
  v_service_key      TEXT;
  v_in_trigger       BOOLEAN;
BEGIN
  v_in_trigger := (pg_trigger_depth() >= 1);

  PERFORM set_config('app.batch_push_pending', 'true', true);

  WITH ins AS (
    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body,
      related_type, related_id,
      context_entity, context_trip, context_creator
    )
    SELECT
      p_trip_id,
      tm.user_id,
      p_type,
      p_title,
      p_body,
      p_related_type,
      p_related_id,
      p_context_entity,
      p_context_trip,
      p_context_creator
    FROM public.trip_members tm
    WHERE tm.trip_id = p_trip_id
      AND tm.user_id != p_exclude_user_id
    RETURNING id, user_id
  )
  SELECT
    COALESCE(array_agg(id ORDER BY user_id), '{}'),
    COALESCE(array_agg(user_id ORDER BY user_id), '{}')
  INTO v_notification_ids, v_user_ids
  FROM ins;

  PERFORM set_config('app.batch_push_pending', 'false', true);

  IF array_length(v_notification_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Inside a trigger (depth >= 1): pg_net drops HTTP jobs silently.
  -- The pg_cron polling job picks up push_sent_at IS NULL rows within ~60 s.
  IF v_in_trigger THEN
    RETURN;
  END IF;

  -- Depth 0 (e.g. send_organizer_nudge RPC): dispatch immediately as one batch.
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

  PERFORM net.http_post(
    url     := v_edge_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'batch',            true,
      'trip_id',          p_trip_id,
      'type',             p_type,
      'title',            p_title,
      'body',             p_body,
      'related_type',     p_related_type,
      'related_id',       p_related_id,
      'notification_ids', v_notification_ids,
      'user_ids',         v_user_ids,
      'context_entity',   p_context_entity,
      'context_trip',     p_context_trip,
      'context_creator',  p_context_creator
    )
  );
END;
$$;
