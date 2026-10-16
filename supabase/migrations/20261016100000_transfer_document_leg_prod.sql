-- v1.39.6 task 1, prod re-apply: separate outbound/return ticket uploads for a round-trip flight.
--
-- Re-applies 20261014110000_transfer_document_leg.sql's schema change to prod. That migration
-- already ran once on prod (as a side effect of an unrelated incident-response `db push` sweeping
-- in all pending migrations) and was deliberately reverted the same day
-- (20261015110000_revert_transfer_document_leg_prod_only.sql), since it changes the ON CONFLICT
-- target the then-live client's ticket upload relied on and the matching client code hadn't
-- shipped yet. A new migration file is needed rather than re-running the original: prod's
-- migration ledger already marks 20261014110000 as "applied" (ledgers are an execution log, not a
-- current-schema tracker — see the migration-create-or-replace-overload-trap skill), so
-- `supabase db push` will never re-run that file.
--
-- Safe to push to prod NOW because the matching client commit (transferDocuments.ts's
-- onConflict: 'flight_id,user_id,leg') is shipping in the same release — this is the exact
-- "client and migration land together" case the no-branches-main-only rule requires, not the
-- ahead-of-the-client case that was unsafe before.
--
-- This migration is PROD ONLY. Dev already has this schema live and unbroken (it was never
-- reverted there) — do NOT also run this migration's DDL on dev; mark it `applied` in dev's
-- ledger via `supabase migration repair 20261016100000 --status applied --linked` instead, the
-- same technique used in reverse for 20261015110000.
--
-- Body is byte-identical to 20261014110000_transfer_document_leg.sql — see that file's header for
-- the original design rationale (leg discriminator mirrors how transfer_flights itself already
-- models the two legs as parallel data; public_transport-parented rows have no leg concept and
-- stay permanently 'outbound').

----------------------------------------------------------------------
-- 1. leg column + widened unique key
----------------------------------------------------------------------

ALTER TABLE public.transfer_documents
  ADD COLUMN leg TEXT NOT NULL DEFAULT 'outbound' CHECK (leg IN ('outbound', 'return'));

ALTER TABLE public.transfer_documents DROP CONSTRAINT transfer_documents_flight_id_user_id_key;
ALTER TABLE public.transfer_documents
  ADD CONSTRAINT transfer_documents_flight_id_user_id_leg_key UNIQUE (flight_id, user_id, leg);

----------------------------------------------------------------------
-- 2. set_transfer_document_trip_id() — also validate leg against the parent flight's direction
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_transfer_document_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_direction TEXT;
BEGIN
  IF NEW.flight_id IS NOT NULL THEN
    SELECT f.trip_id, f.direction INTO NEW.trip_id, v_direction
      FROM public.transfer_flights f WHERE f.id = NEW.flight_id;
    IF NEW.leg = 'return' AND v_direction != 'outbound-return' THEN
      RAISE EXCEPTION 'A return-leg ticket requires a round-trip (outbound-return) flight';
    END IF;
  ELSIF NEW.public_transport_id IS NOT NULL THEN
    SELECT p.trip_id INTO NEW.trip_id FROM public.transfer_public_transport p WHERE p.id = NEW.public_transport_id;
    IF NEW.leg != 'outbound' THEN
      RAISE EXCEPTION 'Public transport tickets have no leg — always outbound';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 3. delete_own_account() — dedupe on (flight_id, leg) / (public_transport_id, leg)
--    Latest body copied verbatim from 20261007100000_multiple_trip_organizers.sql (confirmed no
--    later migration redefines it other than the now-reverted 20261014110000/20261015110000 pair).
----------------------------------------------------------------------

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

  -- v1.39.6: dedupe on (flight_id, leg) / (public_transport_id, leg) now that leg is part of the
  -- unique key — a correlated EXISTS against each row's own leg, not just its parent id, since two
  -- different legs for the same flight must NOT be treated as conflicting.
  DELETE FROM public.transfer_documents td
  WHERE  td.user_id = v_caller
  AND    (
    (td.flight_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.transfer_documents s
      WHERE  s.user_id = v_sentinel AND s.flight_id = td.flight_id AND s.leg = td.leg
    ))
    OR (td.public_transport_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.transfer_documents s
      WHERE  s.user_id = v_sentinel AND s.public_transport_id = td.public_transport_id
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
