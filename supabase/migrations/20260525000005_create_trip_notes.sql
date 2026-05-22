-- Phase: Trip Notes
--
-- Creates:
--   public.trip_notes  – free-text notes per trip (hard delete)
--   trigger: set_updated_at on BEFORE UPDATE
--   trigger: restrict immutable fields (trip_id, created_by)
--   RLS: all members can read; members create/edit/delete own; organizers delete any

----------------------------------------------------------------------
-- 1. TABLE
----------------------------------------------------------------------

CREATE TABLE public.trip_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES public.users(id),
  title       TEXT NOT NULL CHECK (char_length(title) <= 100),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trip_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_trip_notes_trip_id ON public.trip_notes (trip_id);

----------------------------------------------------------------------
-- 2. UPDATED_AT TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE TRIGGER trip_notes_updated_at
  BEFORE UPDATE ON public.trip_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

----------------------------------------------------------------------
-- 3. RLS POLICIES
----------------------------------------------------------------------

-- SELECT: any trip member can read notes
CREATE POLICY "trip_notes_select_member"
  ON public.trip_notes FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

-- INSERT: any trip member can create, must own the row
CREATE POLICY "trip_notes_insert_member"
  ON public.trip_notes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: note creator only
CREATE POLICY "trip_notes_update_owner"
  ON public.trip_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: note creator OR trip organizer
CREATE POLICY "trip_notes_delete_owner_or_organizer"
  ON public.trip_notes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR private.is_trip_organizer(trip_id, auth.uid())
  );

----------------------------------------------------------------------
-- 4. IMMUTABLE FIELDS TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_trip_note_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_trip_note_update_restrict
  BEFORE UPDATE ON public.trip_notes
  FOR EACH ROW EXECUTE FUNCTION public.restrict_trip_note_update_fields();
