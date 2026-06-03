-- Activity Notes
--
-- Collaborative tips/suggestions attached to individual activities.
-- Any trip member can create; only the creator can edit; creator or organizer can delete.
-- trip_id is denormalized (auto-populated from parent activity on INSERT) so RLS filters
-- use the same is_trip_member / is_trip_organizer helpers as every other table.

----------------------------------------------------------------------
-- 1. TABLE
----------------------------------------------------------------------

CREATE TABLE public.activity_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID        NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  trip_id     UUID        NOT NULL REFERENCES public.trips(id)      ON DELETE CASCADE,
  created_by  UUID        NOT NULL REFERENCES public.users(id),
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_notes ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------------------
-- 2. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_activity_notes_activity_id ON public.activity_notes(activity_id);
CREATE INDEX idx_activity_notes_trip_id     ON public.activity_notes(trip_id);
CREATE INDEX idx_activity_notes_created_by  ON public.activity_notes(created_by);

----------------------------------------------------------------------
-- 3. AUTO-POPULATE trip_id FROM PARENT ACTIVITY
--    Mirrors the pattern in 20260523000001_denormalize_trip_id_for_realtime_filters.sql.
--    Also validates that the parent activity has not been soft-deleted.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_activity_note_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT a.trip_id
    INTO NEW.trip_id
    FROM public.activities a
   WHERE a.id = NEW.activity_id
     AND a.deleted_at IS NULL;

  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent activity not found or has been deleted';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_activity_note_trip_id
  BEFORE INSERT ON public.activity_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_note_trip_id();

----------------------------------------------------------------------
-- 4. UPDATED_AT TRIGGER
----------------------------------------------------------------------

CREATE TRIGGER activity_notes_updated_at
  BEFORE UPDATE ON public.activity_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

----------------------------------------------------------------------
-- 5. IMMUTABLE FIELDS TRIGGER
--    Prevents callers from changing activity_id, trip_id, or created_by
--    after a note has been inserted.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_activity_note_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.activity_id IS DISTINCT FROM OLD.activity_id THEN
    RAISE EXCEPTION 'Cannot change activity_id on an activity note';
  END IF;
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id on an activity note';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by on an activity note';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_activity_note_update_restrict
  BEFORE UPDATE ON public.activity_notes
  FOR EACH ROW EXECUTE FUNCTION public.restrict_activity_note_update_fields();

----------------------------------------------------------------------
-- 6. RLS POLICIES
----------------------------------------------------------------------

-- SELECT: any trip member may read notes for non-deleted activities
CREATE POLICY "activity_notes_select_member"
  ON public.activity_notes FOR SELECT TO authenticated
  USING (
    private.is_trip_member(trip_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.activities a
       WHERE a.id = activity_id
         AND a.deleted_at IS NULL
    )
  );

-- INSERT: trip member, must be the note creator, parent activity not deleted
--         (trip_id is supplied by trigger so WITH CHECK evaluates the trigger-set value)
CREATE POLICY "activity_notes_insert_member"
  ON public.activity_notes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.activities a
       WHERE a.id = activity_id
         AND a.deleted_at IS NULL
    )
  );

-- UPDATE: only the note creator may edit the content
CREATE POLICY "activity_notes_update_owner"
  ON public.activity_notes FOR UPDATE TO authenticated
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: note creator or trip organizer
CREATE POLICY "activity_notes_delete_owner_or_organizer"
  ON public.activity_notes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR private.is_trip_organizer(trip_id, auth.uid())
  );
