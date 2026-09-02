-- Code-review fix (finding 1): delete_own_account()'s conflict-avoidance step for
-- transfer_documents only pre-empted the (flight_id, user_id) unique constraint before
-- reassigning to the sentinel user. The (public_transport_id, user_id) constraint, added later
-- by 20260901140001_extend_transfer_documents_for_public_transport.sql, had no matching check —
-- the UPDATE right after it could violate that constraint and abort account deletion entirely.
--
-- Concrete failure: two trip members each ticket the same transfer_public_transport entry. The
-- first deletes their account (their row's user_id -> sentinel). When the second later deletes
-- theirs, the same unconditional UPDATE tries to reassign their row's user_id to the sentinel
-- too, but the sentinel already owns a row with that public_transport_id — unique violation,
-- delete_own_account() fails for that user.
--
-- Full function body copied verbatim from its latest definition
-- (20260901140000_create_transfer_public_transport.sql) — only the transfer_documents
-- conflict-avoidance DELETE is changed, now checking both parent-id branches independently
-- since the two unique constraints are on separate column pairs.

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

  -- transfer_documents: drop rows that would conflict with an existing sentinel ticket, for
  -- EITHER parent type — the (flight_id, user_id) and (public_transport_id, user_id) unique
  -- constraints are independent, and a row conflicts on whichever one it actually populates.
  -- (This is the fix: the flight_id branch alone used to be the whole check.)
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
