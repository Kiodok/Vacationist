-- Accommodation Notes (Task 8)
--
-- Collaborative notes attached to individual accommodation bases.
-- Any trip member can create; only the creator can edit; creator or organizer can delete.
-- Mirrors the activity_notes pattern from 20260603100000_create_activity_notes.sql.

----------------------------------------------------------------------
-- 1. TABLE
----------------------------------------------------------------------

CREATE TABLE public.accommodation_notes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID        NOT NULL REFERENCES public.accommodations(id) ON DELETE CASCADE,
  trip_id          UUID        NOT NULL REFERENCES public.trips(id)          ON DELETE CASCADE,
  created_by       UUID        NOT NULL REFERENCES public.users(id),
  content          TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.accommodation_notes ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------------------
-- 2. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_accommodation_notes_accommodation_id ON public.accommodation_notes(accommodation_id);
CREATE INDEX idx_accommodation_notes_trip_id          ON public.accommodation_notes(trip_id);
CREATE INDEX idx_accommodation_notes_created_by       ON public.accommodation_notes(created_by);

----------------------------------------------------------------------
-- 3. AUTO-POPULATE trip_id FROM PARENT ACCOMMODATION
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_accommodation_note_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT a.trip_id
    INTO NEW.trip_id
    FROM public.accommodations a
   WHERE a.id = NEW.accommodation_id
     AND a.deleted_at IS NULL;

  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent accommodation not found or has been deleted';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_accommodation_note_trip_id
  BEFORE INSERT ON public.accommodation_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_accommodation_note_trip_id();

----------------------------------------------------------------------
-- 4. UPDATED_AT TRIGGER
----------------------------------------------------------------------

CREATE TRIGGER accommodation_notes_updated_at
  BEFORE UPDATE ON public.accommodation_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

----------------------------------------------------------------------
-- 5. IMMUTABLE FIELDS TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_accommodation_note_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.accommodation_id IS DISTINCT FROM OLD.accommodation_id THEN
    RAISE EXCEPTION 'Cannot change accommodation_id on an accommodation note';
  END IF;
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id on an accommodation note';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by on an accommodation note';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_accommodation_note_update_restrict
  BEFORE UPDATE ON public.accommodation_notes
  FOR EACH ROW EXECUTE FUNCTION public.restrict_accommodation_note_update_fields();

----------------------------------------------------------------------
-- 6. RLS POLICIES
----------------------------------------------------------------------

CREATE POLICY "accommodation_notes_select_member"
  ON public.accommodation_notes FOR SELECT TO authenticated
  USING (
    private.is_trip_member(trip_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.accommodations a
       WHERE a.id = accommodation_id
         AND a.deleted_at IS NULL
    )
  );

CREATE POLICY "accommodation_notes_insert_member"
  ON public.accommodation_notes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.accommodations a
       WHERE a.id = accommodation_id
         AND a.deleted_at IS NULL
    )
  );

CREATE POLICY "accommodation_notes_update_owner"
  ON public.accommodation_notes FOR UPDATE TO authenticated
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "accommodation_notes_delete_owner_or_organizer"
  ON public.accommodation_notes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR private.is_trip_organizer(trip_id, auth.uid())
  );
