-- Security fix: the storage RLS self-upload branch for the expense-documents,
-- transfer-documents, and activity-documents buckets never checked trip
-- membership on the trip-id path segment -- only that the leaf user-id
-- segment matched auth.uid(). Any authenticated user (member of zero trips,
-- or a different trip) could write an object into an arbitrary trip's
-- storage namespace, as long as they put their own uid in the leaf segment.
-- Bounded impact (the matching metadata tables already correctly check trip
-- membership, so a forged object can never surface as a legitimate
-- in-app document, and UPDATE/DELETE can only ever touch objects the
-- attacker planted themselves) but a real cross-tenant storage write with
-- zero prerequisites.
--
-- Add private.is_trip_member(((storage.foldername(name))[1])::uuid,
-- auth.uid()) as an additional AND condition on each bucket's INSERT/
-- UPDATE/DELETE policy. SELECT policies already have this check and are
-- left untouched. Policy names/bodies copied verbatim from their creating
-- migrations (20260901110000_create_expense_documents.sql,
-- 20260901110001_create_transfer_documents.sql,
-- 20261003150000_activity_documents_and_toggle.sql -- confirmed none of the
-- 12 storage.objects policies have ever been redefined since), always
-- qualified `ON storage.objects` since same-named table-level policies also
-- exist on public.expense_documents/transfer_documents/activity_documents
-- in those same files.

----------------------------------------------------------------------
-- expense-documents
----------------------------------------------------------------------

DROP POLICY IF EXISTS "expense_documents_insert_owner_or_organizer" ON storage.objects;
CREATE POLICY "expense_documents_insert_owner_or_organizer"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "expense_documents_update_owner_or_organizer" ON storage.objects;
CREATE POLICY "expense_documents_update_owner_or_organizer"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'expense-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "expense_documents_delete_owner_or_organizer" ON storage.objects;
CREATE POLICY "expense_documents_delete_owner_or_organizer"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'expense-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

----------------------------------------------------------------------
-- transfer-documents
----------------------------------------------------------------------

DROP POLICY IF EXISTS "transfer_documents_insert_owner_or_organizer" ON storage.objects;
CREATE POLICY "transfer_documents_insert_owner_or_organizer"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transfer-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "transfer_documents_update_owner_or_organizer" ON storage.objects;
CREATE POLICY "transfer_documents_update_owner_or_organizer"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'transfer-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "transfer_documents_delete_owner_or_organizer" ON storage.objects;
CREATE POLICY "transfer_documents_delete_owner_or_organizer"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'transfer-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

----------------------------------------------------------------------
-- activity-documents
----------------------------------------------------------------------

DROP POLICY IF EXISTS "activity_documents_insert_owner_or_organizer" ON storage.objects;
CREATE POLICY "activity_documents_insert_owner_or_organizer"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'activity-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "activity_documents_update_owner_or_organizer" ON storage.objects;
CREATE POLICY "activity_documents_update_owner_or_organizer"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'activity-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "activity_documents_delete_owner_or_organizer" ON storage.objects;
CREATE POLICY "activity_documents_delete_owner_or_organizer"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'activity-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );
