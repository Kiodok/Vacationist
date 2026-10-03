-- Fixes a gap in 20261003150000_activity_documents_and_toggle.sql: set_activity_document_trip_id()
-- was only wired as a BEFORE INSERT trigger. activityDocuments.ts's uploadActivityDocument()
-- upserts with onConflict: 'activity_id,user_id' (used to replace an existing document), which
-- resolves to an UPDATE on that conflict path and never went through that trigger — so a
-- client-supplied trip_id on the conflict path would be written as-is and then evaluated by the
-- UPDATE policy's WITH CHECK (which reads trip_id off the row), letting a caller potentially spoof
-- which trip a document is attributed to. Re-run the same trip_id derivation (activity_id never
-- changes on this upsert, so re-deriving it from activity_id on every UPDATE is always correct and
-- side-effect-free) BEFORE UPDATE too — same fix, same reasoning, same gap class already closed
-- for transfer_documents by 20260901110002_transfer_documents_trip_id_on_update.sql.

CREATE TRIGGER trg_set_activity_document_trip_id_on_update
  BEFORE UPDATE ON public.activity_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_document_trip_id();
