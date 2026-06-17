-- Allow all trip members (not just organizers) to create prework topics.
-- Edit, delete, and reset remain organizer-only operations.

DROP POLICY IF EXISTS "prework_topics_insert_organizer" ON public.prework_topics;

CREATE POLICY "prework_topics_insert_member"
  ON public.prework_topics FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );
