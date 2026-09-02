-- Fixes a gap in 20260901110001_create_transfer_documents.sql: set_transfer_document_trip_id()
-- was only wired as a BEFORE INSERT trigger. transfer_documents.upsert() (used by
-- uploadTransferFlightDocument to replace an existing ticket) resolves to an UPDATE on the
-- ON CONFLICT (flight_id, user_id) path, which never went through that trigger — so a
-- client-supplied trip_id on the conflict path would be written as-is and then evaluated by the
-- UPDATE policy's WITH CHECK (which reads trip_id off the row), letting a caller potentially
-- spoof which trip a ticket document is attributed to. Re-run the same trip_id derivation
-- (flight_id never changes on this upsert, so re-deriving it from flight_id on every UPDATE is
-- always correct and side-effect-free) BEFORE UPDATE too, closing the gap the same way INSERT
-- already was.

CREATE TRIGGER trg_set_transfer_document_trip_id_on_update
  BEFORE UPDATE ON public.transfer_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_transfer_document_trip_id();
