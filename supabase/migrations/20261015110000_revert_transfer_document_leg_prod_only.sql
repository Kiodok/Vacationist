-- INCIDENT FIX — undo the accidental prod application of
-- 20261014110000_transfer_document_leg.sql.
--
-- That migration was deliberately applied to DEV ONLY (see its own header and
-- engineering/supabase.md's 2026-10-14 entry): it widens transfer_documents' unique key from
-- (flight_id, user_id) to (flight_id, user_id, leg), which changes the ON CONFLICT target the
-- CURRENTLY-LIVE prod client's ticket upload relies on
-- (`upsert(..., { onConflict: 'flight_id,user_id' })` in packages/api/src/transferDocuments.ts,
-- not yet committed/shipped with the matching `,leg` update). It reached prod anyway as a side
-- effect of `supabase db push` applying ALL pending migrations in order (while fixing the
-- separate 20261014100000 overload incident, this one was pending too and got swept up with it).
--
-- No data loss: the `leg` column has existed on prod for only minutes, defaulting every row to
-- 'outbound', and no shipped client has ever written a non-default value.
--
-- This fully reverts transfer_documents to its pre-20261014110000 shape on prod. Dev keeps the
-- feature as originally intended — this migration should be applied to PROD ONLY, leaving dev
-- with the leg column in place for continued development of the matching client change.

-- Dropping the column auto-drops its CHECK and the 3-column UNIQUE constraint that references it
-- (both same-table constraints) — no CASCADE needed.
ALTER TABLE public.transfer_documents DROP COLUMN leg;

ALTER TABLE public.transfer_documents
  ADD CONSTRAINT transfer_documents_flight_id_user_id_key UNIQUE (flight_id, user_id);

-- Restore set_transfer_document_trip_id() to its pre-leg body (verbatim from
-- 20260901140001_extend_transfer_documents_for_public_transport.sql).
CREATE OR REPLACE FUNCTION public.set_transfer_document_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.flight_id IS NOT NULL THEN
    SELECT f.trip_id INTO NEW.trip_id FROM public.transfer_flights f WHERE f.id = NEW.flight_id;
  ELSIF NEW.public_transport_id IS NOT NULL THEN
    SELECT p.trip_id INTO NEW.trip_id FROM public.transfer_public_transport p WHERE p.id = NEW.public_transport_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Restore delete_own_account() to its pre-leg body (verbatim from
-- 20261007100000_multiple_trip_organizers.sql) — the transfer_documents block goes back to
-- deduping by parent id alone, matching the restored 2-column unique constraint.
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
