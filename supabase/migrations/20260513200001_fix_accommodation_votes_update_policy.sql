-- Fix: accommodation_votes UPDATE policy was missing trip membership check
-- in its USING clause. A removed member could still update their vote if
-- the record existed.

DROP POLICY "accommodation_votes_update_own" ON public.accommodation_votes;

CREATE POLICY "accommodation_votes_update_own"
  ON public.accommodation_votes FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.accommodations a
      WHERE a.id = accommodation_id
        AND a.deleted_at IS NULL
        AND private.is_trip_member(a.trip_id, auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.accommodations a
      WHERE a.id = accommodation_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
    )
  );
