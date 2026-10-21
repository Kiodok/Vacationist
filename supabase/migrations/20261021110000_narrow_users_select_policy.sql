-- Security fix: public.users' SELECT policy was `USING (true)`, exposing
-- every user's email to any authenticated session -- including a disposable
-- anonymous guest account created via the /join screen's guest flow, which
-- succeeds even without redeeming a valid invite token first. Narrow to:
-- self, the "Deleted User" sentinel (needed so expenses.ts's
-- payer:users!paid_by(...) / split_user:users!user_id(...) embeds keep
-- resolving a deleted account's display name -- see the
-- deleted-member-expense-split skill; the sentinel has no trip_members row
-- at all), or anyone who shares at least one trip via trip_members.
--
-- Confirmed safe: an exhaustive read of every public.users consumer
-- (packages/api/src/users.ts, members.ts, expenses.ts) found no live
-- feature that reads a user who is neither self nor a co-trip-member --
-- getUserProfile/getUsersByIds (the only arbitrary-id readers) have zero
-- call sites today. No email-lookup/invite-by-email/global-search flow
-- exists anywhere in the app.

CREATE OR REPLACE FUNCTION private.shares_trip_with(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.trip_members a
      JOIN public.trip_members b ON a.trip_id = b.trip_id
     WHERE a.user_id = auth.uid()
       AND b.user_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;

CREATE POLICY "users_select_self_or_co_member"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR id = '00000000-0000-0000-0000-000000000000'::uuid
    OR private.shares_trip_with(id)
  );
