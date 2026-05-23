-- Security fix: restrict_notification_update_fields allowed authenticated users
-- to write push_sent_at because it was excluded from the immutable-field check.
-- This field is an internal system timestamp set only by the Edge Function
-- (service_role) to record when a push was dispatched.
--
-- Fix: block push_sent_at changes when auth.uid() IS NOT NULL (authenticated
-- user context). Service-role calls have no JWT so auth.uid() returns NULL —
-- those are still permitted, preserving Edge Function behaviour.

CREATE OR REPLACE FUNCTION public.restrict_notification_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Block any change to structural / immutable fields.
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

  -- push_sent_at is an internal system field set only by the Edge Function
  -- (service_role). Authenticated users must not be able to write it.
  IF NEW.push_sent_at IS DISTINCT FROM OLD.push_sent_at AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'push_sent_at can only be set by the system';
  END IF;

  RETURN NEW;
END;
$$;
