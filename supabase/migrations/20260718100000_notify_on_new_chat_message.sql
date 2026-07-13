-- Add new_chat_message notification type and preference column, then wire up the trigger.

-- 1. Extend the notifications type constraint.
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'new_activity', 'vote_update', 'expense_change', 'new_member',
    'schedule_change', 'reminder', 'vote_finalized', 'document_access_request',
    'lost_found', 'shared_packing', 'activity_note', 'expense_settlement',
    'trip_deleted', 'member_left', 'new_chat_message'
  )
);

-- 2. Add per-trip preference column (default ON so existing members keep receiving them).
ALTER TABLE public.notification_preferences
  ADD COLUMN new_chat_message BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Trigger function: fires on INSERT only (edits and deletes are UPDATEs — not notified).
CREATE OR REPLACE FUNCTION public.notify_on_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_sender_name TEXT;
  v_trip_title  TEXT;
BEGIN
  SELECT name INTO v_sender_name FROM public.users WHERE id = NEW.created_by;
  SELECT title INTO v_trip_title FROM public.trips WHERE id = NEW.trip_id AND deleted_at IS NULL;

  -- Skip if the trip was already soft-deleted.
  IF v_trip_title IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM private.create_trip_notification(
    NEW.trip_id,           -- p_trip_id
    NEW.created_by,        -- p_exclude_user_id (don't notify the sender)
    'new_chat_message',    -- p_type
    'New chat message',    -- p_title (overridden by client i18n)
    NULL,                  -- p_body
    'trip_message',        -- p_related_type
    NEW.id,                -- p_related_id
    LEFT(NEW.text, 200),   -- p_context_entity (message preview)
    v_trip_title,          -- p_context_trip
    v_sender_name          -- p_context_creator
  );

  RETURN NEW;
END;
$$;

-- 4. Attach trigger — AFTER INSERT only, so edits and soft-deletes (UPDATEs) are silent.
CREATE TRIGGER notify_new_chat_message
  AFTER INSERT ON public.trip_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_chat_message();
