-- v1.33.0 task 8: expense document uploads (receipts, tickets, etc.) via Supabase Storage.
--
-- Private bucket (unlike the public `avatars` bucket) — per Tech Lead decision, any trip member
-- can VIEW a document attached to an expense they can already see, but only the uploader or the
-- trip organizer can upload/replace/delete it. Path convention:
-- {trip_id}/expenses/{expense_id}/{user_id}/{filename} — folder segment [1] is the trip_id used
-- by the RLS policies below (storage.foldername() is 1-indexed and excludes the filename),
-- segment [4] is the uploading user's id.
--
-- Multiple documents per expense are allowed (e.g. a receipt photo + a warranty card) — no
-- uniqueness constraint, each upload is its own row, unlike the one-ticket-per-passenger model
-- used for transfer_documents (20260901110001).

----------------------------------------------------------------------
-- 1. Storage bucket + RLS
----------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expense-documents', 'expense-documents', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "expense_documents_select_trip_member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'expense-documents'
    AND private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "expense_documents_insert_owner_or_organizer"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-documents'
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY "expense_documents_update_owner_or_organizer"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'expense-documents'
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY "expense_documents_delete_owner_or_organizer"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'expense-documents'
    AND (
      ((storage.foldername(name))[4])::uuid = auth.uid()
      OR private.is_trip_organizer(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

----------------------------------------------------------------------
-- 2. expense_documents table (metadata pointing at the storage object)
----------------------------------------------------------------------

CREATE TABLE public.expense_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  expense_id    UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  uploaded_by   UUID NOT NULL REFERENCES public.users(id),
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL CHECK (char_length(file_name) <= 255),
  mime_type     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expense_documents ENABLE ROW LEVEL SECURITY;

-- Denormalized trip_id, auto-populated from expense_id — same pattern as
-- set_expense_split_trip_id() (20260523000001_denormalize_trip_id_for_realtime_filters.sql).
CREATE OR REPLACE FUNCTION public.set_expense_document_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT e.trip_id INTO NEW.trip_id FROM public.expenses e WHERE e.id = NEW.expense_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_expense_document_trip_id
  BEFORE INSERT ON public.expense_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_expense_document_trip_id();

CREATE POLICY "expense_documents_select_member"
  ON public.expense_documents FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "expense_documents_insert_member"
  ON public.expense_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND private.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "expense_documents_delete_owner_or_organizer"
  ON public.expense_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()));

CREATE INDEX idx_expense_documents_expense_id ON public.expense_documents(expense_id);
CREATE INDEX idx_expense_documents_trip_id ON public.expense_documents(trip_id);
