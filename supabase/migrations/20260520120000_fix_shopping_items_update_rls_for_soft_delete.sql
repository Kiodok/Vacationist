-- Fix shopping_items UPDATE RLS policy to allow setting deleted_at.
-- The USING clause already ensures only rows with deleted_at IS NULL can be
-- selected for update. The WITH CHECK was also requiring deleted_at IS NULL
-- on the NEW row, which blocked soft-deletes via direct UPDATE.
-- This is needed for recipe ingredient propagation (soft-deleting linked
-- shopping items when a recipe ingredient is removed).

DROP POLICY "shopping_items_update_member" ON public.shopping_items;

CREATE POLICY "shopping_items_update_member"
  ON public.shopping_items FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = shopping_list_id
        AND private.is_trip_member(sl.trip_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = shopping_list_id
        AND private.is_trip_member(sl.trip_id, auth.uid())
    )
  );
