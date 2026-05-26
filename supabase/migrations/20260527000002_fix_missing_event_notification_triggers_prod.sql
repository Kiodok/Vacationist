-- Fix: notification event triggers missing on prod.
--
-- Migration 20260522213024 was recorded in prod's schema_migrations history but
-- the CREATE TRIGGER statements were not present in the file at the time it was
-- first applied. The six trg_notify_* triggers (and their backing functions) are
-- absent from prod while dev has all of them.
--
-- This migration recreates the missing triggers + functions idempotently:
--   DROP TRIGGER IF EXISTS is a no-op on dev (triggers already exist) and safely
--   removes any partial state on prod before recreating.

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
    NEW.created_by,
    'new_activity',
    'New activity added',
    NEW.title,
    'activity',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_activity ON public.activities;
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
    NEW.created_by,
    'expense_change',
    'New expense added',
    NEW.title,
    'expense',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_expense ON public.expenses;
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
    NEW.user_id,
    'new_member',
    COALESCE(v_member_name, 'Someone') || ' joined the trip',
    COALESCE(v_member_name, 'A new member') || ' is now part of the trip.',
    'member',
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_member ON public.trip_members;
CREATE TRIGGER trg_notify_new_member
  AFTER INSERT ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION private.notify_new_member();

----------------------------------------------------------------------
-- 4. ACTIVITY VOTING FINALIZED
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_activity_vote_finalized()
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
    'activity',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_activity_vote_finalized ON public.activities;
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

DROP TRIGGER IF EXISTS trg_notify_accommodation_vote_finalized ON public.accommodations;
CREATE TRIGGER trg_notify_accommodation_vote_finalized
  AFTER UPDATE ON public.accommodations
  FOR EACH ROW EXECUTE FUNCTION private.notify_accommodation_vote_finalized();

----------------------------------------------------------------------
-- 6. ACTIVITY SCHEDULE CHANGE
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_schedule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NOT (
    NEW.activity_date IS DISTINCT FROM OLD.activity_date OR
    NEW.start_time    IS DISTINCT FROM OLD.start_time    OR
    NEW.end_time      IS DISTINCT FROM OLD.end_time
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    auth.uid(),
    'schedule_change',
    'Schedule updated',
    '"' || NEW.title || '" has a new date or time.',
    'activity',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_schedule_change ON public.activities;
CREATE TRIGGER trg_notify_schedule_change
  AFTER UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION private.notify_schedule_change();
