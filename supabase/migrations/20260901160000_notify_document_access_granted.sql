-- Task 11: notify the organizer when a member responds to their document-access request
-- with a grant. respond_to_document_access_request() (20260525000003) inserts into
-- document_access_grants but nothing ever notified anyone about the response — only the
-- original *request* is notified (notify_document_access_request, 20260525000007), which
-- correctly targets the *members*, not the organizer who made the request.

-- 1. Extend the notifications type constraint.
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'new_activity', 'vote_update', 'expense_change', 'new_member',
    'schedule_change', 'reminder', 'vote_finalized', 'document_access_request',
    'lost_found', 'shared_packing', 'activity_note', 'expense_settlement',
    'trip_deleted', 'member_left', 'new_chat_message', 'document_access_granted'
  )
);

-- 2. Trigger function: single-recipient notification (the organizer who requested access),
-- fired on the member's grant response. create_trip_notification() only supports "everyone
-- except one user", not "exactly one user", so this is a direct INSERT — same pattern as
-- notify_lost_found_target_user_changed() (20260611172912). Denials are silent by design
-- (an organizer doesn't need a push every time someone says no); only an actual grant fires.
CREATE OR REPLACE FUNCTION private.notify_document_access_granted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request      RECORD;
  v_granter_name TEXT;
  v_trip_title   TEXT;
BEGIN
  IF NOT NEW.granted THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_request FROM public.document_access_requests WHERE id = NEW.request_id;
  SELECT name  INTO v_granter_name FROM public.users WHERE id = NEW.user_id;
  SELECT title INTO v_trip_title   FROM public.trips WHERE id = v_request.trip_id;

  -- context_trip/context_creator populated (unlike notify_document_access_request, which
  -- passes none) so this new type is actually locale-translated client + push side, not
  -- just falling back to the DB-stored English text.
  INSERT INTO public.notifications (
    trip_id, user_id, type, title, body, related_type, related_id,
    context_trip, context_creator
  ) VALUES (
    v_request.trip_id,
    v_request.requested_by,
    'document_access_granted',
    'Document access granted',
    COALESCE(v_granter_name, 'A member') || ' granted you access to their travel documents in "'
      || COALESCE(v_trip_title, 'your trip') || '".',
    'document_access_request',
    NEW.request_id,
    v_trip_title,
    v_granter_name
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_document_access_granted ON public.document_access_grants;

CREATE TRIGGER trg_notify_document_access_granted
  AFTER INSERT ON public.document_access_grants
  FOR EACH ROW EXECUTE FUNCTION private.notify_document_access_granted();
