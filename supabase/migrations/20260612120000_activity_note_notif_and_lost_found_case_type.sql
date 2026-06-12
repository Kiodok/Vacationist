-- Migration: activity note push notifications + lost_found case_type editability
--
-- 1. Extend notifications_type_check to include 'activity_note'.
-- 2. Remove the case_type immutability restriction from lost_found_cases so users can
--    switch between "person unknown / known" variants when editing a case.
-- 3. Add a push notification trigger for new activity notes (INSERT only; edits are silent).

----------------------------------------------------------------------
-- 1. ADD 'activity_note' TO notifications_type_check
----------------------------------------------------------------------

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'new_activity',
    'vote_update',
    'expense_change',
    'new_member',
    'schedule_change',
    'reminder',
    'vote_finalized',
    'document_access_request',
    'lost_found',
    'shared_packing',
    'activity_note'
  ));

----------------------------------------------------------------------
-- 2. ALLOW case_type CHANGES ON lost_found_cases
--    Keep trip_id and created_by immutable; remove the case_type guard.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_lost_found_case_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id on lost_found_cases';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by on lost_found_cases';
  END IF;
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 3. PUSH NOTIFICATION TRIGGER FOR NEW ACTIVITY NOTES
--    Gates on the 'new_activity' notification preference column so users
--    who mute activity notifications also mute note notifications.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.notify_activity_note_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity_title TEXT;
  v_trip_title     TEXT;
  v_creator_name   TEXT;
BEGIN
  SELECT a.title, t.title
    INTO v_activity_title, v_trip_title
    FROM public.activities a
    JOIN public.trips t ON t.id = a.trip_id
   WHERE a.id = NEW.activity_id;

  SELECT name INTO v_creator_name FROM public.users WHERE id = NEW.created_by;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.created_by,          -- exclude the note author
    'activity_note',
    'Note added',
    COALESCE(v_creator_name, 'Someone')
      || ' added a note to "'
      || COALESCE(v_activity_title, 'an activity')
      || '" in "'
      || COALESCE(v_trip_title, 'your trip')
      || '".',
    'activity',
    NEW.activity_id,
    v_activity_title,        -- context_entity = activity title
    v_trip_title,            -- context_trip
    v_creator_name           -- context_creator
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_activity_note_added ON public.activity_notes;

CREATE TRIGGER trg_notify_activity_note_added
  AFTER INSERT ON public.activity_notes
  FOR EACH ROW EXECUTE FUNCTION private.notify_activity_note_added();
