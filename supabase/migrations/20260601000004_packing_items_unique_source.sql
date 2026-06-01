-- Fix: ON CONFLICT DO NOTHING in the trigger was a no-op because no unique
-- constraint existed. This partial index gives it a conflict target so
-- duplicate auto-inserted rows (trigger replay, multiple 'everyone' items)
-- are silently ignored as intended.

CREATE UNIQUE INDEX idx_packing_items_unique_source
  ON public.packing_items(trip_id, user_id, source_shared_item_id)
  WHERE source_shared_item_id IS NOT NULL
    AND deleted_at IS NULL;
