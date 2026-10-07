-- v1.39.5: Multiple organizers per trip.
--
-- Trips can now have more than one trip_members row with role = 'organizer'.
-- There is deliberately no new "main_organizer" role/column: the main
-- organizer is whoever trips.created_by points at. Only the main organizer
-- may appoint/revoke the organizer role on other members, remove a member
-- who already holds the organizer role, or delete the trip. Any organizer
-- (main or appointed) keeps every other existing organizer power (invites,
-- nudge, member documents, removing participants/guests, closing voting,
-- editing the trip).

----------------------------------------------------------------------
-- 1. HELPER: is the caller the trip's creator (main organizer)?
----------------------------------------------------------------------

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
  );
$$;

----------------------------------------------------------------------
-- 2. trip_members: only the main organizer can change a member's role
----------------------------------------------------------------------

DROP POLICY IF EXISTS "trip_members_update" ON public.trip_members;
CREATE POLICY "trip_members_update_main_organizer"
  ON public.trip_members FOR UPDATE TO authenticated
  USING (private.is_trip_creator(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_creator(trip_id, auth.uid()));

----------------------------------------------------------------------
-- 3. trip_members: removing an organizer-role member requires the main
--    organizer; any organizer can still remove a participant/guest; anyone
--    can still remove themselves (blocked for the creator's own row by the
--    trigger in section 4).
----------------------------------------------------------------------

DROP POLICY IF EXISTS "trip_members_delete" ON public.trip_members;
CREATE POLICY "trip_members_delete"
  ON public.trip_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_trip_creator(trip_id, auth.uid())
    OR (private.is_trip_organizer(trip_id, auth.uid()) AND role != 'organizer')
  );

----------------------------------------------------------------------
-- 4. Extend the existing organizer-protection triggers:
--    - The main organizer's own row can never be demoted or removed
--      (outside of delete_own_account(), which runs with
--      session_replication_role = 'replica' and already bypasses these
--      triggers today).
--    - A role change never involves 'guest' on either side — guests are
--      never promoted, and nothing demotes an organizer into a guest row.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_last_organizer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = OLD.trip_id AND created_by = OLD.user_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove the main organizer from a trip';
  END IF;

  IF OLD.role = 'organizer' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = OLD.trip_id
        AND role = 'organizer'
        AND id != OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot remove the last organizer from a trip';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_organizer_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = OLD.trip_id AND created_by = OLD.user_id
    ) THEN
      RAISE EXCEPTION 'Cannot change the main organizer''s role';
    END IF;

    IF OLD.role = 'guest' OR NEW.role = 'guest' THEN
      RAISE EXCEPTION 'A guest cannot be promoted, and a member cannot be demoted to guest';
    END IF;
  END IF;

  IF OLD.role = 'organizer' AND NEW.role != 'organizer' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = OLD.trip_id
        AND role = 'organizer'
        AND id != OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot demote the last organizer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 5. soft_delete_trip: only the main organizer can delete the trip
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_trip(p_trip_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_title TEXT;
  v_actor_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_creator(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: only the main organizer can delete a trip';
  END IF;

  -- Fetch context for notification before the trip is hidden
  SELECT title INTO v_trip_title FROM public.trips WHERE id = p_trip_id AND deleted_at IS NULL;
  SELECT name  INTO v_actor_name FROM public.users WHERE id = auth.uid();

  -- Notify all non-organizer members while trip_members is still intact
  IF v_trip_title IS NOT NULL THEN
    PERFORM private.create_trip_notification(
      p_trip_id,
      auth.uid(),
      'trip_deleted',
      'Trip deleted',
      NULL,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT,
      v_trip_title,
      v_actor_name
    );
  END IF;

  UPDATE public.trips
  SET deleted_at = NOW()
  WHERE id = p_trip_id
    AND deleted_at IS NULL;

  -- Revoke all active invite tokens so existing links can no longer be redeemed
  UPDATE public.invite_tokens
  SET revoked_at = NOW()
  WHERE trip_id = p_trip_id
    AND revoked_at IS NULL;
END;
$$;

----------------------------------------------------------------------
-- 6. delete_own_account: transfer main-organizer status off the caller's
--    created trips (instead of letting it go dormant at the sentinel),
--    preferring an existing/just-promoted organizer, before the generic
--    sentinel reassignment.
----------------------------------------------------------------------

-- Full current body (as of 20261003150000_activity_documents_and_toggle.sql), with exactly one
-- insertion: the "transfer main-organizer status" block below, placed after the existing
-- last-organizer promotion loop and before the generic sentinel reassignment. Nothing else in
-- this body is changed.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_sentinel UUID := '00000000-0000-0000-0000-000000000000';
  v_trip_id  UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller = v_sentinel THEN
    RAISE EXCEPTION 'Cannot delete the sentinel user';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_caller AND is_guest) THEN
    RAISE EXCEPTION 'Guest accounts cannot be deleted via this RPC';
  END IF;

  SET LOCAL session_replication_role = 'replica';

  FOR v_trip_id IN
    SELECT tm.trip_id
    FROM   public.trip_members tm
    WHERE  tm.user_id = v_caller
    AND    tm.role = 'organizer'
    AND    NOT EXISTS (
      SELECT 1 FROM public.trip_members tm2
      WHERE  tm2.trip_id  = tm.trip_id
      AND    tm2.role     = 'organizer'
      AND    tm2.user_id != v_caller
    )
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = v_trip_id AND user_id != v_caller
    ) THEN
      UPDATE public.trip_members
      SET    role = 'organizer'
      WHERE  id = (
        SELECT id FROM public.trip_members
        WHERE  trip_id = v_trip_id
        AND    user_id != v_caller
        ORDER BY (role = 'guest'), joined_at ASC
        LIMIT 1
      );
    ELSE
      UPDATE public.trips
      SET    deleted_at = now()
      WHERE  id = v_trip_id
      AND    deleted_at IS NULL;
    END IF;
  END LOOP;

  ----------------------------------------------------------------
  -- v1.39.5: Transfer main-organizer status (trips.created_by) off the
  -- caller's created trips, preferring an existing/just-promoted organizer,
  -- so a trip never permanently loses the ability to appoint new organizers
  -- just because its creator deleted their account. Trips with no other
  -- members are left alone here — they were soft-deleted above, and the
  -- generic sentinel reassignment below covers them.
  ----------------------------------------------------------------
  UPDATE public.trips t
  SET    created_by = (
    SELECT user_id FROM public.trip_members
    WHERE  trip_id = t.id AND user_id != v_caller
    ORDER BY (role = 'organizer') DESC, (role = 'guest') ASC, joined_at ASC
    LIMIT 1
  )
  WHERE  t.created_by = v_caller
  AND    t.deleted_at IS NULL
  AND    EXISTS (SELECT 1 FROM public.trip_members WHERE trip_id = t.id AND user_id != v_caller);

  UPDATE public.trips                    SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.activities               SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.accommodations           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.shopping_lists           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.shopping_items           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.recipes                  SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_flights         SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_vehicles        SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_rentals         SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_public_transport SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.trip_notes               SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.activity_notes           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.accommodation_notes      SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.prework_topics           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.invite_tokens            SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.trip_messages            SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.expense_documents        SET uploaded_by = v_sentinel WHERE uploaded_by = v_caller;

  UPDATE public.expenses
  SET    created_by = CASE WHEN created_by = v_caller THEN v_sentinel ELSE created_by END,
         paid_by    = CASE WHEN paid_by    = v_caller THEN v_sentinel ELSE paid_by    END,
         updated_by = CASE WHEN updated_by = v_caller THEN NULL       ELSE updated_by END
  WHERE  created_by = v_caller OR paid_by = v_caller OR updated_by = v_caller;

  UPDATE public.settlement_receipts  SET settled_by = v_sentinel WHERE settled_by = v_caller;

  DELETE FROM public.expense_splits
  WHERE  user_id    = v_caller
  AND    expense_id IN (
    SELECT expense_id FROM public.expense_splits WHERE user_id = v_sentinel
  );

  UPDATE public.expense_splits
  SET    user_id    = CASE WHEN user_id    = v_caller THEN v_sentinel ELSE user_id    END,
         covered_by = CASE WHEN covered_by = v_caller THEN NULL       ELSE covered_by END
  WHERE  user_id = v_caller OR covered_by = v_caller;

  DELETE FROM public.transfer_documents
  WHERE  user_id = v_caller
  AND    (
    (flight_id IS NOT NULL AND flight_id IN (
      SELECT flight_id FROM public.transfer_documents WHERE user_id = v_sentinel AND flight_id IS NOT NULL
    ))
    OR (public_transport_id IS NOT NULL AND public_transport_id IN (
      SELECT public_transport_id FROM public.transfer_documents WHERE user_id = v_sentinel AND public_transport_id IS NOT NULL
    ))
  );

  UPDATE public.transfer_documents
  SET    user_id     = CASE WHEN user_id     = v_caller THEN v_sentinel ELSE user_id     END,
         uploaded_by = CASE WHEN uploaded_by = v_caller THEN v_sentinel ELSE uploaded_by END
  WHERE  user_id = v_caller OR uploaded_by = v_caller;

  -- activity_documents: drop rows that would conflict with an existing sentinel document
  -- (UNIQUE(activity_id, user_id) blocks reassignment when a prior deletion already placed the
  -- sentinel on the same activity) — same shape transfer_documents originally used for its
  -- flight_id-only case.
  DELETE FROM public.activity_documents
  WHERE  user_id     = v_caller
  AND    activity_id IN (
    SELECT activity_id FROM public.activity_documents WHERE user_id = v_sentinel
  );

  UPDATE public.activity_documents
  SET    user_id     = CASE WHEN user_id     = v_caller THEN v_sentinel ELSE user_id     END,
         uploaded_by = CASE WHEN uploaded_by = v_caller THEN v_sentinel ELSE uploaded_by END
  WHERE  user_id = v_caller OR uploaded_by = v_caller;

  UPDATE public.shared_packing_items
  SET    created_by = CASE WHEN created_by = v_caller THEN v_sentinel ELSE created_by END,
         claimed_by = CASE WHEN claimed_by = v_caller THEN NULL       ELSE claimed_by END
  WHERE  created_by = v_caller OR claimed_by = v_caller;

  UPDATE public.lost_found_cases
  SET    created_by  = CASE WHEN created_by  = v_caller THEN v_sentinel ELSE created_by  END,
         target_user = CASE WHEN target_user = v_caller THEN NULL       ELSE target_user END
  WHERE  created_by = v_caller OR target_user = v_caller;

  DELETE FROM storage.objects
  WHERE  bucket_id = 'avatars'
  AND    name LIKE v_caller::text || '/%';

  DELETE FROM public.trip_members WHERE user_id = v_caller;

  SET LOCAL session_replication_role = 'origin';

  DELETE FROM auth.users WHERE id = v_caller;

END;
$$;
