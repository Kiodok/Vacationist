-- Fix: session_replication_role = 'replica' disables FK CASCADE, so
-- DELETE FROM auth.users did not propagate to auth.identities, auth.sessions,
-- or public.users — leaving the account in a broken half-deleted state and
-- preventing re-signup with the same email.
--
-- Fix strategy:
--   1. Keep session_replication_role = 'replica' for all UPDATE statements
--      (still needed to bypass check_last_organizer and other user triggers).
--   2. Explicitly DELETE trip_members for the caller (in replica mode, to bypass
--      check_last_organizer) — this is the only user-defined-trigger risk on CASCADE.
--   3. Reset to 'origin' before DELETE FROM auth.users so that CASCADE propagates:
--      auth.users → auth.identities, auth.sessions, public.users
--      public.users → trip_members (already empty), votes, notifications, push_tokens, etc.

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

  -- Block guest accounts from permanent deletion — guests are converted or
  -- expired, not deleted via this RPC.
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_caller AND is_guest) THEN
    RAISE EXCEPTION 'Guest accounts cannot be deleted via this RPC';
  END IF;

  -- Disable user-defined triggers for this transaction only.
  -- Bypasses: check_last_organizer, restrict_*_update_fields, notification triggers.
  -- NOTE: also disables FK CASCADE — we reset to 'origin' before the final DELETE.
  SET LOCAL session_replication_role = 'replica';

  ----------------------------------------------------------------
  -- Handle last-organizer trips
  --    - Other members exist → promote earliest-joined member.
  --    - Caller is sole member → soft-delete the trip.
  ----------------------------------------------------------------
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
        ORDER BY created_at ASC
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
  -- Reassign non-cascading FK references to the sentinel
  ----------------------------------------------------------------

  UPDATE public.trips                SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.activities           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.accommodations       SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.shopping_lists       SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.shopping_items       SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.recipes              SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_flights     SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_vehicles    SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_rentals     SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.trip_notes           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.activity_notes       SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.accommodation_notes  SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.prework_topics       SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.invite_tokens        SET created_by = v_sentinel WHERE created_by = v_caller;

  -- expenses: created_by + paid_by + updated_by in one pass
  UPDATE public.expenses
  SET    created_by = CASE WHEN created_by = v_caller THEN v_sentinel ELSE created_by END,
         paid_by    = CASE WHEN paid_by    = v_caller THEN v_sentinel ELSE paid_by    END,
         updated_by = CASE WHEN updated_by = v_caller THEN NULL       ELSE updated_by END
  WHERE  created_by = v_caller OR paid_by = v_caller OR updated_by = v_caller;

  UPDATE public.settlement_receipts  SET settled_by = v_sentinel WHERE settled_by = v_caller;

  -- expense_splits: drop rows that would conflict with an existing sentinel split
  -- (UNIQUE(expense_id, user_id) blocks reassignment when a prior deletion already
  -- placed the sentinel on the same expense).
  DELETE FROM public.expense_splits
  WHERE  user_id    = v_caller
  AND    expense_id IN (
    SELECT expense_id FROM public.expense_splits WHERE user_id = v_sentinel
  );

  -- expense_splits: reassign + null out covered_by in one pass
  UPDATE public.expense_splits
  SET    user_id    = CASE WHEN user_id    = v_caller THEN v_sentinel ELSE user_id    END,
         covered_by = CASE WHEN covered_by = v_caller THEN NULL       ELSE covered_by END
  WHERE  user_id = v_caller OR covered_by = v_caller;

  -- shared_packing_items: reassign created_by + null out claimed_by in one pass
  UPDATE public.shared_packing_items
  SET    created_by = CASE WHEN created_by = v_caller THEN v_sentinel ELSE created_by END,
         claimed_by = CASE WHEN claimed_by = v_caller THEN NULL       ELSE claimed_by END
  WHERE  created_by = v_caller OR claimed_by = v_caller;

  -- lost_found_cases: reassign created_by + null out target_user in one pass
  UPDATE public.lost_found_cases
  SET    created_by  = CASE WHEN created_by  = v_caller THEN v_sentinel ELSE created_by  END,
         target_user = CASE WHEN target_user = v_caller THEN NULL       ELSE target_user END
  WHERE  created_by = v_caller OR target_user = v_caller;

  ----------------------------------------------------------------
  -- Delete avatar from storage
  ----------------------------------------------------------------
  DELETE FROM storage.objects
  WHERE  bucket_id = 'avatars'
  AND    name LIKE v_caller::text || '/%';

  ----------------------------------------------------------------
  -- Remove caller from trip_members explicitly while replica mode
  -- is still active — avoids the check_last_organizer trigger, which
  -- would otherwise fire when CASCADE later deletes these rows.
  ----------------------------------------------------------------
  DELETE FROM public.trip_members WHERE user_id = v_caller;

  ----------------------------------------------------------------
  -- Re-enable FK enforcement so that the final DELETE propagates
  -- via CASCADE to:
  --   auth.users → auth.identities, auth.sessions, auth.refresh_tokens
  --   auth.users → public.users → votes, notifications, push_tokens, etc.
  -- Without this reset, re-signup with the same email fails because
  -- the orphaned auth.identities row blocks GoTrue.
  ----------------------------------------------------------------
  SET LOCAL session_replication_role = 'origin';

  DELETE FROM auth.users WHERE id = v_caller;

END;
$$;
