-- Security fix: prevent users from self-elevating by writing is_guest = false
-- via the users_update_own RLS policy.
-- The policy allows UPDATE on any column; this trigger blocks is_guest changes
-- from any non-service-role caller.

CREATE OR REPLACE FUNCTION public.restrict_user_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_guest IS DISTINCT FROM OLD.is_guest THEN
    RAISE EXCEPTION 'is_guest cannot be changed by the user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_user_self_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.restrict_user_self_update();
