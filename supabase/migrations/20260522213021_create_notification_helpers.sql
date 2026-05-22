-- Phase 8: Notifications
-- Migration 4: private.create_trip_notification helper and send_organizer_nudge RPC

----------------------------------------------------------------------
-- 1. CORE HELPER: private.create_trip_notification
-- Creates a notification row for every trip member excluding the actor.
-- Called by all event triggers. Each INSERT fires the push dispatch trigger.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_trip_notification(
  p_trip_id        UUID,
  p_exclude_user_id UUID,   -- actor; pass '00000000-0000-0000-0000-000000000000' to notify all
  p_type           TEXT,
  p_title          TEXT,
  p_body           TEXT     DEFAULT NULL,
  p_related_type   TEXT     DEFAULT NULL,
  p_related_id     UUID     DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member RECORD;
BEGIN
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
    );
  END LOOP;
END;
$$;

----------------------------------------------------------------------
-- 2. RPC: send_organizer_nudge
-- Organizer sends a playful nudge message to all trip members.
-- Rate-limited to 3 nudges per trip per hour.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_organizer_nudge(
  p_trip_id UUID,
  p_title   TEXT,
  p_body    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_nudge_count INTEGER;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only trip organizers may send nudges
  IF NOT private.is_trip_organizer(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Only trip organizers can send nudges';
  END IF;

  -- Validate inputs
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Nudge title is required';
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Nudge body is required';
  END IF;

  -- Rate limit: max 3 nudges per trip per hour
  SELECT COUNT(*) INTO v_nudge_count
  FROM public.notifications
  WHERE trip_id = p_trip_id
    AND type = 'reminder'
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_nudge_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit: max 3 nudges per trip per hour';
  END IF;

  PERFORM private.create_trip_notification(
    p_trip_id,
    v_caller,
    'reminder',
    trim(p_title),
    trim(p_body),
    NULL,
    NULL
  );
END;
$$;
