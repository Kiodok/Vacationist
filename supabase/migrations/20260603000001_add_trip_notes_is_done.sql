-- Phase: Notes enhancement
--
-- Adds is_done column to trip_notes so any trip member can mark a note as done.
-- Non-owners remain restricted from editing title/description (enforced by trigger).

------------------------------------------------------------------------
-- 1. ADD COLUMN
------------------------------------------------------------------------

ALTER TABLE public.trip_notes
  ADD COLUMN is_done BOOLEAN NOT NULL DEFAULT FALSE;

------------------------------------------------------------------------
-- 2. NEW RLS POLICY — any trip member may update (for toggling is_done)
--
-- The existing "trip_notes_update_owner" policy allows only the creator
-- to UPDATE. PostgreSQL ORs multiple UPDATE policies together, so adding
-- this policy lets any member attempt an update. The trigger below
-- restricts non-owners to only changing is_done.
------------------------------------------------------------------------

CREATE POLICY "trip_notes_update_member_is_done"
  ON public.trip_notes FOR UPDATE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()));

------------------------------------------------------------------------
-- 3. EXTEND IMMUTABLE-FIELDS TRIGGER
--
-- Replace the existing function so non-owners cannot change title or
-- description — they may only toggle is_done.
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_trip_note_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- These fields are permanently immutable for everyone
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  -- Non-owner may only toggle is_done
  IF NEW.created_by != auth.uid() THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
    THEN
      RAISE EXCEPTION 'Only the note creator can edit the title and description';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
