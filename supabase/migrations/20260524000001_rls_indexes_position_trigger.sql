-- Performance & scaling improvements:
--
-- 1. Rewrite SELECT (and some INSERT/UPDATE) RLS policies on 4 child tables to use
--    the denormalized trip_id column (added in 20260523000001) instead of JOINing
--    to the parent table. Eliminates one correlated subquery per row.
--
-- 2. Add composite indexes for hot query paths.
--
-- 3. Add BEFORE INSERT trigger on shopping_items to assign position atomically,
--    eliminating the client-side SELECT-max-position + INSERT double round-trip.

----------------------------------------------------------------------
-- 1. RLS POLICY REWRITES
----------------------------------------------------------------------

-- ---- activity_votes ----

DROP POLICY IF EXISTS "activity_votes_select_member" ON public.activity_votes;
CREATE POLICY "activity_votes_select_member"
  ON public.activity_votes FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

-- INSERT: keep parent JOIN to verify voting_open; use trip_id for membership check
DROP POLICY IF EXISTS "activity_votes_insert_member" ON public.activity_votes;
CREATE POLICY "activity_votes_insert_member"
  ON public.activity_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
    )
  );

-- ---- accommodation_votes ----

DROP POLICY IF EXISTS "accommodation_votes_select_member" ON public.accommodation_votes;
CREATE POLICY "accommodation_votes_select_member"
  ON public.accommodation_votes FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "accommodation_votes_insert_member" ON public.accommodation_votes;
CREATE POLICY "accommodation_votes_insert_member"
  ON public.accommodation_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.accommodations a
      WHERE a.id = accommodation_id
        AND a.voting_open = TRUE
        AND a.deleted_at IS NULL
    )
  );

-- ---- expense_splits ----

DROP POLICY IF EXISTS "expense_splits_select_member" ON public.expense_splits;
CREATE POLICY "expense_splits_select_member"
  ON public.expense_splits FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

-- INSERT: keep JOIN to check archived_at and created_by; use trip_id for organizer check
DROP POLICY IF EXISTS "expense_splits_insert_creator" ON public.expense_splits;
CREATE POLICY "expense_splits_insert_creator"
  ON public.expense_splits FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id
        AND e.archived_at IS NULL
        AND (e.created_by = auth.uid() OR private.is_trip_organizer(trip_id, auth.uid()))
    )
  );

-- ---- shopping_items ----
-- SELECT, INSERT, UPDATE all previously joined to shopping_lists to get trip_id.
-- Now trip_id is on the row directly.

DROP POLICY IF EXISTS "shopping_items_select_member" ON public.shopping_items;
CREATE POLICY "shopping_items_select_member"
  ON public.shopping_items FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "shopping_items_insert_member" ON public.shopping_items;
CREATE POLICY "shopping_items_insert_member"
  ON public.shopping_items FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "shopping_items_update_member" ON public.shopping_items;
CREATE POLICY "shopping_items_update_member"
  ON public.shopping_items FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  )
  WITH CHECK (
    deleted_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  );

----------------------------------------------------------------------
-- 2. COMPOSITE INDEXES
----------------------------------------------------------------------

-- Shopping items ordered by position within a list
CREATE INDEX IF NOT EXISTS idx_shopping_items_list_position
  ON public.shopping_items(shopping_list_id, position)
  WHERE deleted_at IS NULL;

-- Calendar queries: activities filtered by trip + date
CREATE INDEX IF NOT EXISTS idx_activities_trip_date
  ON public.activities(trip_id, activity_date)
  WHERE deleted_at IS NULL AND activity_date IS NOT NULL;

-- Balance calculation: expense_splits by expense + settlement status
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_status
  ON public.expense_splits(expense_id, status);

----------------------------------------------------------------------
-- 3. SHOPPING ITEM POSITION TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_shopping_item_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT COALESCE(MAX(position), -1) + 1 INTO NEW.position
    FROM public.shopping_items
   WHERE shopping_list_id = NEW.shopping_list_id
     AND deleted_at IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_shopping_item_position
  BEFORE INSERT ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.set_shopping_item_position();
