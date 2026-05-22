-- Phase 8: Notifications
-- Migration 3: notification_preferences table, RLS, and auto-create trigger

----------------------------------------------------------------------
-- 1. TABLE
----------------------------------------------------------------------
CREATE TABLE public.notification_preferences (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id         UUID    NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  new_activity    BOOLEAN NOT NULL DEFAULT TRUE,
  vote_update     BOOLEAN NOT NULL DEFAULT TRUE,
  expense_change  BOOLEAN NOT NULL DEFAULT TRUE,
  new_member      BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_change BOOLEAN NOT NULL DEFAULT TRUE,
  reminder        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (user_id, trip_id)
);

----------------------------------------------------------------------
-- 2. RLS
----------------------------------------------------------------------
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "notification_preferences_select_own"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own preferences (toggles)
CREATE POLICY "notification_preferences_update_own"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Direct inserts are blocked — auto-created when joining a trip via trigger
CREATE POLICY "notification_preferences_deny_direct_insert"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (false);

----------------------------------------------------------------------
-- 3. AUTO-CREATE TRIGGER
-- Creates default preferences when a user joins a trip
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.auto_create_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id, trip_id)
  VALUES (NEW.user_id, NEW.trip_id)
  ON CONFLICT (user_id, trip_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_notification_preferences
  AFTER INSERT ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION private.auto_create_notification_preferences();

----------------------------------------------------------------------
-- 4. INDEXES
----------------------------------------------------------------------
CREATE INDEX idx_notification_preferences_user_trip
  ON public.notification_preferences (user_id, trip_id);
