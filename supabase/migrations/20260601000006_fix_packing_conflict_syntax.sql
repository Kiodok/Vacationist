-- Fix: ON CONFLICT ON CONSTRAINT only works with ADD CONSTRAINT, not CREATE UNIQUE INDEX.
-- Recreate the index without the deleted_at predicate (simpler ON CONFLICT clause),
-- then rewrite both RPCs to use the correct ON CONFLICT (columns) WHERE predicate syntax.

----------------------------------------------------------------------
-- 1. Replace partial index (drop the deleted_at IS NULL predicate)
----------------------------------------------------------------------

DROP INDEX IF EXISTS idx_packing_items_unique_source;

CREATE UNIQUE INDEX idx_packing_items_unique_source
  ON public.packing_items(trip_id, user_id, source_shared_item_id)
  WHERE source_shared_item_id IS NOT NULL;

----------------------------------------------------------------------
-- 2. Rewrite claim_shared_packing_item with correct ON CONFLICT syntax
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_shared_packing_item(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_trip_id     UUID;
  v_title       TEXT;
  v_item_type   TEXT;
  v_claimed     UUID;
  v_category    TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, title, item_type, claimed_by
  INTO v_trip_id, v_title, v_item_type, v_claimed
  FROM public.shared_packing_items
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared packing item not found';
  END IF;

  IF v_item_type != 'who_has' THEN
    RAISE EXCEPTION 'Only who_has items can be claimed';
  END IF;

  IF v_claimed IS NOT NULL THEN
    RAISE EXCEPTION 'Item already claimed';
  END IF;

  IF NOT private.is_trip_member(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT name INTO v_category
  FROM public.packing_categories
  WHERE is_default = TRUE AND name = 'Shared'
  LIMIT 1;

  IF v_category IS NULL THEN
    v_category := 'Shared';
  END IF;

  UPDATE public.shared_packing_items
  SET claimed_by = v_caller, is_resolved = TRUE
  WHERE id = p_item_id;

  INSERT INTO public.packing_items (trip_id, user_id, category, title, source_shared_item_id)
  VALUES (v_trip_id, v_caller, v_category, v_title, p_item_id)
  ON CONFLICT (trip_id, user_id, source_shared_item_id) WHERE source_shared_item_id IS NOT NULL
  DO NOTHING;
END;
$$;

----------------------------------------------------------------------
-- 3. Rewrite handle_shared_packing_item_insert with correct ON CONFLICT syntax
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.handle_shared_packing_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member   RECORD;
  v_category TEXT;
BEGIN
  SELECT name INTO v_category
  FROM public.packing_categories
  WHERE is_default = TRUE AND name = 'Shared'
  LIMIT 1;

  IF v_category IS NULL THEN
    v_category := 'Shared';
  END IF;

  IF NEW.item_type = 'everyone' THEN
    FOR v_member IN
      SELECT user_id FROM public.trip_members WHERE trip_id = NEW.trip_id
    LOOP
      INSERT INTO public.packing_items (trip_id, user_id, category, title, source_shared_item_id)
      VALUES (NEW.trip_id, v_member.user_id, v_category, NEW.title, NEW.id)
      ON CONFLICT (trip_id, user_id, source_shared_item_id) WHERE source_shared_item_id IS NOT NULL
      DO NOTHING;
    END LOOP;

    PERFORM private.create_trip_notification(
      NEW.trip_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      'shared_packing',
      'Everyone brings: ' || NEW.title,
      NULL,
      'shared_packing_item',
      NEW.id
    );

  ELSIF NEW.item_type = 'i_got_it' THEN
    INSERT INTO public.packing_items (trip_id, user_id, category, title, source_shared_item_id)
    VALUES (NEW.trip_id, NEW.created_by, v_category, NEW.title, NEW.id)
    ON CONFLICT (trip_id, user_id, source_shared_item_id) WHERE source_shared_item_id IS NOT NULL
    DO NOTHING;

    PERFORM private.create_trip_notification(
      NEW.trip_id,
      NEW.created_by,
      'shared_packing',
      'Bringing: ' || NEW.title,
      NULL,
      'shared_packing_item',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
