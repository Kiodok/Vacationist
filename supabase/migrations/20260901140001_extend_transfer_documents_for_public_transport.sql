-- v1.33.0 task 17 (continued): reuse the transfer_documents table/bucket (created for flight
-- tickets in 20260901110001/110002) for Public Transport tickets too, rather than a parallel
-- table — same storage bucket, same RLS shape, same upload/replace/delete flow, just a second
-- optional parent column.

ALTER TABLE public.transfer_documents ALTER COLUMN flight_id DROP NOT NULL;

ALTER TABLE public.transfer_documents
  ADD COLUMN public_transport_id UUID REFERENCES public.transfer_public_transport(id) ON DELETE CASCADE;

-- Exactly one parent per row.
ALTER TABLE public.transfer_documents
  ADD CONSTRAINT transfer_documents_exactly_one_parent
  CHECK ((flight_id IS NOT NULL)::int + (public_transport_id IS NOT NULL)::int = 1);

-- One ticket per (public_transport_id, passenger) — NULLs in flight_id/public_transport_id don't
-- collide with each other under a UNIQUE constraint (Postgres never treats NULL = NULL), so this
-- coexists safely with the existing UNIQUE(flight_id, user_id).
ALTER TABLE public.transfer_documents
  ADD CONSTRAINT transfer_documents_public_transport_user_unique UNIQUE (public_transport_id, user_id);

-- trip_id derivation now branches on whichever parent is set.
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
-- Existing BEFORE INSERT / BEFORE UPDATE triggers already call this function by name — CREATE OR
-- REPLACE updates their behavior with no trigger-definition changes needed (same signature).

CREATE INDEX idx_transfer_documents_public_transport_id ON public.transfer_documents(public_transport_id);
