-- Fix: push notifications not delivered for event-triggered notifications
-- (new_activity, new_expense, new_member, vote_finalized, schedule_change).
--
-- Root cause: private.create_trip_notification() calls net.http_post() while
-- running at pg_trigger_depth() >= 1 (invoked from AFTER INSERT triggers on
-- activities, expenses, trip_members, etc.). Supabase hosted pg_net silently
-- drops HTTP jobs queued from within a trigger stack — confirmed by
-- net.http_request_queue returning 0 rows immediately after activity creation.
-- Nudges work because send_organizer_nudge is a plain RPC (depth 0).
--
-- Fix:
--   1. create_trip_notification detects pg_trigger_depth() >= 1 and skips the
--      net.http_post() call. Notifications are still INSERTed correctly; only
--      the HTTP dispatch step is deferred to the polling job.
--   2. A new private.dispatch_pending_push_notifications() function finds rows
--      with push_sent_at IS NULL (and not recently queued) and calls net.http_post()
--      once per notification — always at depth 0, so pg_net queues correctly.
--   3. push_queued_at column tracks when a row entered the dispatch queue to
--      prevent duplicate pushes within the 5-minute retry window.
--   4. A pg_cron job runs every minute to drive the polling function.
--
-- Nudges (RPC, depth 0): delivery unchanged — immediate batch HTTP call.
-- Event notifications (trigger, depth >= 1): max ~60 s latency via cron.

----------------------------------------------------------------------
-- 1. ADD push_queued_at TO notifications
----------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_queued_at TIMESTAMPTZ;

-- Update the update-guard trigger to protect push_queued_at the same way
-- push_sent_at is protected — only the system (auth.uid() IS NULL) may set it.
CREATE OR REPLACE FUNCTION public.restrict_notification_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Structural / immutable fields.
  IF NEW.trip_id      IS DISTINCT FROM OLD.trip_id      OR
     NEW.user_id      IS DISTINCT FROM OLD.user_id      OR
     NEW.type         IS DISTINCT FROM OLD.type         OR
     NEW.title        IS DISTINCT FROM OLD.title        OR
     NEW.body         IS DISTINCT FROM OLD.body         OR
     NEW.related_type IS DISTINCT FROM OLD.related_type OR
     NEW.related_id   IS DISTINCT FROM OLD.related_id   OR
     NEW.created_at   IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Cannot modify immutable notification fields';
  END IF;

  -- System-only fields: only the service role / SECURITY DEFINER jobs may write these.
  IF NEW.push_sent_at IS DISTINCT FROM OLD.push_sent_at AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'push_sent_at can only be set by the system';
  END IF;

  IF NEW.push_queued_at IS DISTINCT FROM OLD.push_queued_at AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'push_queued_at can only be set by the system';
  END IF;

  RETURN NEW;
END;
$$;

-- Index to make the polling SELECT fast (push_sent_at IS NULL rows only).
CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications (created_at ASC)
  WHERE push_sent_at IS NULL;

----------------------------------------------------------------------
-- 2. REWRITE create_trip_notification — skip HTTP at trigger depth >= 1
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
  v_in_trigger       BOOLEAN;
BEGIN
  -- Detect whether we are running inside a trigger stack. When true,
  -- net.http_post() would be silently dropped by pg_net on Supabase hosted,
  -- so we defer push dispatch to the pg_cron polling job instead.
  v_in_trigger := (pg_trigger_depth() >= 1);

  -- Signal the per-row dispatch trigger to skip while we INSERT in bulk.
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

  -- Reset flag before any further work so nested triggers behave normally.
  PERFORM set_config('app.batch_push_pending', 'false', true);

  IF array_length(v_notification_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Inside a trigger (depth >= 1): pg_net drops HTTP jobs silently.
  -- The pg_cron polling job will pick up push_sent_at IS NULL rows within ~60 s.
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
      'user_ids',         v_user_ids
    )
  );
END;
$$;

----------------------------------------------------------------------
-- 3. POLLING DISPATCH FUNCTION (always called at depth 0 by pg_cron)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.dispatch_pending_push_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge_fn_url  TEXT;
  v_service_key  TEXT;
  v_rec          RECORD;
  v_count        INTEGER := 0;
BEGIN
  SELECT decrypted_secret INTO v_edge_fn_url
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_edge_fn_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_notification_service_role_key'
  LIMIT 1;

  IF v_edge_fn_url IS NULL OR v_service_key IS NULL THEN
    RETURN 0;
  END IF;

  -- Candidates: unsent AND (never queued OR last queued > 5 min ago for retry).
  -- Process oldest first; cap at 200 rows per cron tick to bound execution time.
  FOR v_rec IN
    SELECT id, trip_id, user_id, type, title, body, related_type, related_id
    FROM public.notifications
    WHERE push_sent_at IS NULL
      AND (
        push_queued_at IS NULL
        OR push_queued_at < NOW() - INTERVAL '5 minutes'
      )
    ORDER BY created_at ASC
    LIMIT 200
  LOOP
    -- Stamp push_queued_at before the HTTP call to prevent a concurrent cron
    -- tick from re-queuing the same row within the 5-minute retry window.
    UPDATE public.notifications
    SET push_queued_at = NOW()
    WHERE id = v_rec.id;

    PERFORM net.http_post(
      url     := v_edge_fn_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := jsonb_build_object(
        'notification_id', v_rec.id,
        'trip_id',         v_rec.trip_id,
        'user_id',         v_rec.user_id,
        'type',            v_rec.type,
        'title',           v_rec.title,
        'body',            v_rec.body,
        'related_type',    v_rec.related_type,
        'related_id',      v_rec.related_id
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- 4. pg_cron — poll every minute
----------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any stale version of this job before (re-)scheduling.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'dispatch-pending-push-notifications';

SELECT cron.schedule(
  'dispatch-pending-push-notifications',
  '* * * * *',
  $$SELECT private.dispatch_pending_push_notifications()$$
);
