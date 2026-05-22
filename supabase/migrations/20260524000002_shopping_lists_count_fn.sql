-- Replace the client-side item count approach with a server-side aggregation.
--
-- Previously: getShoppingLists used .select('*, shopping_items(id, status)')
-- which fetched all item rows to the client just to count them.
--
-- This RPC does the aggregation in SQL with FILTER, returning one row per list
-- with item_count (non-deleted) and bought_count (non-deleted + status='bought').

CREATE OR REPLACE FUNCTION public.get_shopping_lists_with_counts(p_trip_id UUID)
RETURNS TABLE (
  id           UUID,
  trip_id      UUID,
  title        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ,
  archived_at  TIMESTAMPTZ,
  item_count   BIGINT,
  bought_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  RETURN QUERY
  SELECT
    sl.id,
    sl.trip_id,
    sl.title,
    sl.created_by,
    sl.created_at,
    sl.updated_at,
    sl.archived_at,
    COUNT(si.id) FILTER (WHERE si.deleted_at IS NULL)                          AS item_count,
    COUNT(si.id) FILTER (WHERE si.deleted_at IS NULL AND si.status = 'bought') AS bought_count
  FROM public.shopping_lists sl
  LEFT JOIN public.shopping_items si ON si.shopping_list_id = sl.id
  WHERE sl.trip_id = p_trip_id
  GROUP BY sl.id
  ORDER BY sl.created_at ASC;
END;
$$;
