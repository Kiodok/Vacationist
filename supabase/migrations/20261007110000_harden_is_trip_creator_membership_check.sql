-- v1.39.5 follow-up (/code-review finding): private.is_trip_creator() granted exclusive
-- main-organizer authority based solely on trips.created_by, with no check that the caller still
-- has a current trip_members row. Under today's code this can never actually diverge (the
-- creator's trip_members row is immutable outside delete_own_account(), which always transfers
-- created_by in the same transaction before the row can disappear), but the helper should not
-- rely on that invariant being preserved by every future caller — a bulk admin script, or a later
-- migration that touches trip_members with session_replication_role = 'replica', could otherwise
-- leave a non-member holding full main-organizer power over a trip. Defense in depth: require the
-- caller to still be a trip_members row.

CREATE OR REPLACE FUNCTION private.is_trip_creator(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = p_trip_id
      AND created_by = p_user_id
  ) AND EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id
      AND user_id = p_user_id
  );
$$;
