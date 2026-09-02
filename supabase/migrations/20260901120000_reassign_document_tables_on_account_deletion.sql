-- Fixes a gap from the v1.33.0 document-upload migrations (20260901110000/110001): both new
-- tables have NOT NULL FK columns to public.users without ON DELETE CASCADE
-- (expense_documents.uploaded_by; transfer_documents.user_id + uploaded_by), so any user who had
-- uploaded a document would hit a foreign-key violation (23503) on delete_own_account()'s final
-- DELETE FROM auth.users — the exact same class of bug fixed for trip_messages.created_by on
-- 2026-07-27 (see 20260727130000_fix_delete_own_account_joined_at_and_chat.sql). Per CLAUDE.md's
-- Account Deletion rule, every new created_by/uploaded_by/user_id FK to public.users needs a
-- reassignment line added here in the same feature's migration set.
--
-- transfer_documents also needs the same conflict-avoidance two-step already used for
-- expense_splits: UNIQUE(flight_id, user_id) would block reassigning user_id to the sentinel if
-- a prior account deletion already left a sentinel-owned ticket row for the same flight.
--
-- Underlying Storage objects are left in place (not deleted, unlike the `avatars` cleanup this
-- function does) — the DB row's storage_path still resolves correctly via signed URL regardless
-- of whose user-id folder segment it sits under, and this content is trip data the other members
-- still depend on, same as every other content type this function anonymizes rather than erases.

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
  --    - Other members exist → promote earliest-joined participant,
  --      falling back to a guest only if no participant remains.
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
  UPDATE public.trip_messages        SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.expense_documents    SET uploaded_by = v_sentinel WHERE uploaded_by = v_caller;

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

  -- transfer_documents: drop rows that would conflict with an existing sentinel ticket
  -- (UNIQUE(flight_id, user_id) blocks reassignment when a prior deletion already placed
  -- the sentinel on the same flight).
  DELETE FROM public.transfer_documents
  WHERE  user_id   = v_caller
  AND    flight_id IN (
    SELECT flight_id FROM public.transfer_documents WHERE user_id = v_sentinel
  );

  -- transfer_documents: reassign user_id + uploaded_by in one pass
  UPDATE public.transfer_documents
  SET    user_id     = CASE WHEN user_id     = v_caller THEN v_sentinel ELSE user_id     END,
         uploaded_by = CASE WHEN uploaded_by = v_caller THEN v_sentinel ELSE uploaded_by END
  WHERE  user_id = v_caller OR uploaded_by = v_caller;

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
