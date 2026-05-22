-- Phase 8: Notifications
-- Migration 2: notifications table, RLS, update guard trigger, and read RPCs

----------------------------------------------------------------------
-- 1. TABLE
----------------------------------------------------------------------
CREATE TABLE public.notifications (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id      UUID        NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN (
                             'new_activity',
                             'vote_update',
                             'expense_change',
                             'new_member',
                             'schedule_change',
                             'reminder',
                             'vote_finalized',
                             'document_access_request'
                           )),
  title        TEXT        NOT NULL,
  body         TEXT,
  related_type TEXT,
  related_id   UUID,
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  push_sent_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

----------------------------------------------------------------------
-- 2. UPDATE GUARD TRIGGER
-- Only allow changing is_read and push_sent_at via UPDATE
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restrict_notification_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_notification_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.restrict_notification_update_fields();

----------------------------------------------------------------------
-- 3. RLS
----------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients can read their own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Recipients can mark their own as read / update push_sent_at
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Direct inserts are blocked — all inserts go through SECURITY DEFINER functions
CREATE POLICY "notifications_deny_direct_insert"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Recipients can delete their own notifications
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

----------------------------------------------------------------------
-- 4. RPCS
----------------------------------------------------------------------

-- Mark a single notification as read (caller must own it)
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id UUID
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

  UPDATE public.notifications
  SET is_read = TRUE
  WHERE id = p_notification_id
    AND user_id = v_caller;
END;
$$;

-- Mark all notifications as read for the caller; optionally scoped to a trip
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
  p_trip_id UUID DEFAULT NULL
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

  UPDATE public.notifications
  SET is_read = TRUE
  WHERE user_id = v_caller
    AND is_read = FALSE
    AND (p_trip_id IS NULL OR trip_id = p_trip_id);
END;
$$;

-- Returns unread notification count for the caller; optionally scoped to a trip
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(
  p_trip_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_count  INTEGER;
BEGIN
  IF v_caller IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = v_caller
    AND is_read = FALSE
    AND (p_trip_id IS NULL OR trip_id = p_trip_id);

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- 5. INDEXES
----------------------------------------------------------------------
CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX idx_notifications_trip_user
  ON public.notifications (trip_id, user_id, created_at DESC);
