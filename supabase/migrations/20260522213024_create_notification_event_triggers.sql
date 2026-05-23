-- Phase 8: Notifications
-- Migration 6: Event triggers that create notification rows on key DB events

-- Sentinel UUID used to exclude nobody (notify ALL members)
-- '00000000-0000-0000-0000-000000000000' matches no real user_id

----------------------------------------------------------------------
-- 1. NEW ACTIVITY
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_new_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.created_by,           -- exclude creator
    'new_activity',
    'New activity added',
    NEW.title,
    'activity',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_activity
  AFTER INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION private.notify_new_activity();

----------------------------------------------------------------------
-- 2. NEW EXPENSE
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_new_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.created_by,           -- exclude creator
    'expense_change',
    'New expense added',
    NEW.title,
    'expense',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_expense
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.notify_new_expense();

----------------------------------------------------------------------
-- 3. NEW MEMBER
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_new_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member_name TEXT;
BEGIN
  SELECT name INTO v_member_name
  FROM public.users
  WHERE id = NEW.user_id;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.user_id,              -- exclude the new member themselves
    'new_member',
    COALESCE(v_member_name, 'Someone') || ' joined the trip',
    COALESCE(v_member_name, 'A new member') || ' is now part of the trip.',
    'member',
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_member
  AFTER INSERT ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION private.notify_new_member();

----------------------------------------------------------------------
-- 4. ACTIVITY VOTING FINALIZED
-- Fires when voting_open transitions TRUE → FALSE on an activity
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_activity_vote_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only fire on voting_open TRUE → FALSE transition
  IF NOT (OLD.voting_open = TRUE AND NEW.voting_open = FALSE) THEN
    RETURN NEW;
  END IF;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    '00000000-0000-0000-0000-000000000000'::UUID,  -- notify all members
    'vote_finalized',
    'Voting finalized',
    'Voting is closed for "' || NEW.title || '".',
    'activity',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_activity_vote_finalized
  AFTER UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION private.notify_activity_vote_finalized();

----------------------------------------------------------------------
-- 5. ACCOMMODATION VOTING FINALIZED
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_accommodation_vote_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (OLD.voting_open = TRUE AND NEW.voting_open = FALSE) THEN
    RETURN NEW;
  END IF;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'vote_finalized',
    'Voting finalized',
    'Voting is closed for "' || NEW.title || '".',
    'accommodation',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_accommodation_vote_finalized
  AFTER UPDATE ON public.accommodations
  FOR EACH ROW EXECUTE FUNCTION private.notify_accommodation_vote_finalized();

----------------------------------------------------------------------
-- 6. ACTIVITY SCHEDULE CHANGE
-- Fires when activity_date, start_time, or end_time changes
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_schedule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Skip if triggered by a nested trigger (e.g., auto-finalize updates)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only fire when date/time fields actually changed (not voting_open, status, etc.)
  IF NOT (
    NEW.activity_date IS DISTINCT FROM OLD.activity_date OR
    NEW.start_time    IS DISTINCT FROM OLD.start_time    OR
    NEW.end_time      IS DISTINCT FROM OLD.end_time
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    auth.uid(),               -- exclude the user making the change
    'schedule_change',
    'Schedule updated',
    '"' || NEW.title || '" has a new date or time.',
    'activity',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_schedule_change
  AFTER UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION private.notify_schedule_change();

-- 7. DOCUMENT ACCESS REQUEST trigger is in 20260525000007_notify_document_access_request_trigger.sql
-- (must run after document_access_requests table is created in 20260525000003)
