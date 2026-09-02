-- v1.33.0 task 15: flight ticket document uploads via Supabase Storage.
--
-- One document per (flight, passenger) — a passenger's outbound and return tickets are already
-- separate transfer_flights rows (direction column), so this maps directly onto existing rows
-- with no new "leg" concept. UNIQUE(flight_id, user_id) + upsert semantics let either the
-- passenger themselves or the organizer replace an existing ticket with a new one, matching the
-- task's "replace it with a new one" requirement.
--
-- Path convention: {trip_id}/transfer/{flight_id}/{user_id}/ticket — a FIXED filename (no
-- extension, like the avatars bucket's `${userId}/avatar` path) so a replace upload overwrites
-- the same storage object in place via `upsert: true`; the real filename/extension is preserved
-- in the file_name/mime_type columns for display, same division of responsibility as avatars
-- (storage holds bytes + Content-Type, the DB row holds the human-facing metadata).
--
-- uploaded_by (who performed the upload) is tracked separately from user_id (which passenger the
-- ticket belongs to) because the organizer can upload on behalf of any passenger.

----------------------------------------------------------------------
-- 1. Storage bucket + RLS
----------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('transfer-documents', 'transfer-documents', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "transfer_documents_select_trip_member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'transfer-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "transfer_documents_insert_owner_or_organizer"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transfer-documents'
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY "transfer_documents_update_owner_or_organizer"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'transfer-documents'
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY "transfer_documents_delete_owner_or_organizer"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'transfer-documents'
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

----------------------------------------------------------------------
-- 2. transfer_documents table
----------------------------------------------------------------------

CREATE TABLE public.transfer_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  flight_id     UUID NOT NULL REFERENCES public.transfer_flights(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id),  -- passenger this ticket belongs to
  uploaded_by   UUID NOT NULL REFERENCES public.users(id),  -- who performed the upload
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL CHECK (char_length(file_name) <= 255),
  mime_type     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flight_id, user_id)
);

ALTER TABLE public.transfer_documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER transfer_documents_updated_at
  BEFORE UPDATE ON public.transfer_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Denormalized trip_id, auto-populated from flight_id — same pattern as
-- set_expense_document_trip_id() above.
CREATE OR REPLACE FUNCTION public.set_transfer_document_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT f.trip_id INTO NEW.trip_id FROM public.transfer_flights f WHERE f.id = NEW.flight_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_transfer_document_trip_id
  BEFORE INSERT ON public.transfer_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_transfer_document_trip_id();

CREATE POLICY "transfer_documents_select_member"
  ON public.transfer_documents FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

-- Insert/replace: the passenger themselves, or the trip organizer uploading on their behalf.
CREATE POLICY "transfer_documents_insert_owner_or_organizer"
  ON public.transfer_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (user_id = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()))
  );

CREATE POLICY "transfer_documents_update_owner_or_organizer"
  ON public.transfer_documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()))
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (user_id = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()))
  );

CREATE POLICY "transfer_documents_delete_owner_or_organizer"
  ON public.transfer_documents FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()));

CREATE INDEX idx_transfer_documents_flight_id ON public.transfer_documents(flight_id);
CREATE INDEX idx_transfer_documents_trip_id ON public.transfer_documents(trip_id);
