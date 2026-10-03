-- v1.39.3 task 2: per-person activity document uploads, gated by a new activities.documents_enabled
-- switch (set at create/edit time). Most activities won't need a document at all — unlike
-- flights/public-transport, where virtually every entry has a real ticket — so this is opt-in
-- rather than an always-on section like TicketsSection already is for Transfers.
--
-- activity_documents is a NEW, separate table (not grafted onto transfer_documents) — activities
-- are a distinct parent entity, same reasoning transfer_documents itself used to justify its own
-- table rather than reusing expense_documents. Table/bucket/RLS shape copied verbatim from
-- transfer_documents (20260901110001_create_transfer_documents.sql), with a single `activity_id`
-- parent column (no dual-parent branching needed, since activities aren't shared with any other
-- entity type the way transfer_documents is shared between flights and public transport).

----------------------------------------------------------------------
-- 1. activities.documents_enabled + create_activity RPC
----------------------------------------------------------------------

ALTER TABLE public.activities
  ADD COLUMN documents_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- DROP required because PostgreSQL forbids changing the signature via CREATE OR REPLACE — same
-- dance as the reservation_required/auto_close additions to this RPC.
DROP FUNCTION IF EXISTS public.create_activity(UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, TIME, TIME, TEXT, TEXT, BOOLEAN, BOOLEAN);

CREATE FUNCTION public.create_activity(
  p_trip_id               UUID,
  p_title                 TEXT,
  p_description           TEXT    DEFAULT NULL,
  p_category              TEXT    DEFAULT NULL,
  p_cost_estimate         NUMERIC DEFAULT NULL,
  p_activity_date         DATE    DEFAULT NULL,
  p_start_time            TIME    DEFAULT NULL,
  p_end_time              TIME    DEFAULT NULL,
  p_external_url          TEXT    DEFAULT NULL,
  p_maps_url              TEXT    DEFAULT NULL,
  p_reservation_required  BOOLEAN DEFAULT FALSE,
  p_auto_close            BOOLEAN DEFAULT FALSE,
  p_documents_enabled     BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  INSERT INTO public.activities (
    trip_id, title, description, category, cost_estimate,
    activity_date, start_time, end_time, external_url, maps_url,
    reservation_required, auto_close, documents_enabled, created_by
  )
  VALUES (
    p_trip_id, p_title, p_description, p_category, p_cost_estimate,
    p_activity_date, p_start_time, p_end_time, p_external_url, p_maps_url,
    p_reservation_required, p_auto_close, p_documents_enabled, v_caller
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

----------------------------------------------------------------------
-- 2. Storage bucket + RLS
----------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('activity-documents', 'activity-documents', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "activity_documents_select_trip_member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'activity-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "activity_documents_insert_owner_or_organizer"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'activity-documents'
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY "activity_documents_update_owner_or_organizer"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'activity-documents'
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY "activity_documents_delete_owner_or_organizer"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'activity-documents'
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

----------------------------------------------------------------------
-- 3. activity_documents table
----------------------------------------------------------------------

CREATE TABLE public.activity_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  activity_id   UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id),  -- member this document belongs to
  uploaded_by   UUID NOT NULL REFERENCES public.users(id),  -- who performed the upload
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL CHECK (char_length(file_name) <= 255),
  mime_type     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, user_id)
);

ALTER TABLE public.activity_documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER activity_documents_updated_at
  BEFORE UPDATE ON public.activity_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_activity_document_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT a.trip_id INTO NEW.trip_id FROM public.activities a WHERE a.id = NEW.activity_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_activity_document_trip_id
  BEFORE INSERT ON public.activity_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_document_trip_id();

CREATE POLICY "activity_documents_select_member"
  ON public.activity_documents FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "activity_documents_insert_owner_or_organizer"
  ON public.activity_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (user_id = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()))
  );

CREATE POLICY "activity_documents_update_owner_or_organizer"
  ON public.activity_documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()))
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (user_id = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()))
  );

CREATE POLICY "activity_documents_delete_owner_or_organizer"
  ON public.activity_documents FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()));

CREATE INDEX idx_activity_documents_activity_id ON public.activity_documents(activity_id);
CREATE INDEX idx_activity_documents_trip_id ON public.activity_documents(trip_id);

----------------------------------------------------------------------
-- 4. delete_own_account(): reassign activity_documents' new non-cascading FKs
--    (user_id, uploaded_by -> public.users), per CLAUDE.md's Account Deletion rule. Full function
--    body copied verbatim from its latest definition
--    (20260902110000_fix_delete_own_account_public_transport_documents.sql) — only the new
--    activity_documents block is added, same conflict-avoidance shape as the single-parent
--    (flight_id-only) case transfer_documents originally used, since activity_documents has only
--    one parent column.
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
