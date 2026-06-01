-- unclaim_shared_packing_item:
--   i_got_it  → creator sets is_resolved = FALSE (no longer bringing it)
--   who_has   → claimer OR creator sets claimed_by = NULL, is_resolved = FALSE

CREATE OR REPLACE FUNCTION public.unclaim_shared_packing_item(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_trip_id   UUID;
  v_item_type TEXT;
  v_created_by UUID;
  v_claimed_by UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, item_type, created_by, claimed_by
  INTO v_trip_id, v_item_type, v_created_by, v_claimed_by
  FROM public.shared_packing_items
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared packing item not found';
  END IF;

  IF NOT private.is_trip_member(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_item_type = 'everyone' THEN
    RAISE EXCEPTION 'Everyone items cannot be unclaimed';
  END IF;

  IF v_item_type = 'i_got_it' THEN
    IF v_caller != v_created_by THEN
      RAISE EXCEPTION 'Only the creator can revert an i_got_it item';
    END IF;
    UPDATE public.shared_packing_items
    SET is_resolved = FALSE
    WHERE id = p_item_id;

  ELSIF v_item_type = 'who_has' THEN
    IF v_caller != v_claimed_by AND v_caller != v_created_by THEN
      RAISE EXCEPTION 'Only the claimer or creator can unclaim a who_has item';
    END IF;
    UPDATE public.shared_packing_items
    SET claimed_by = NULL, is_resolved = FALSE
    WHERE id = p_item_id;
  END IF;
END;
$$;
