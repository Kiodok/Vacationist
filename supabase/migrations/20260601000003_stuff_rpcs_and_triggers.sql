-- Phase: Stuff Feature
-- Migration 3: RPCs and event triggers for packing lists and lost & found

----------------------------------------------------------------------
-- 1. soft_delete_packing_item
-- Owner (user_id = caller) can soft-delete their own packing item.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_packing_item(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_user_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.packing_items
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Packing item not found';
  END IF;

  IF v_user_id != v_caller THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.packing_items
  SET deleted_at = NOW()
  WHERE id = p_item_id;
END;
$$;

----------------------------------------------------------------------
-- 2. soft_delete_shared_packing_item
-- Organizer or creator can soft-delete.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_shared_packing_item(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_trip_id    UUID;
  v_created_by UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, created_by INTO v_trip_id, v_created_by
  FROM public.shared_packing_items
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared packing item not found';
  END IF;

  IF v_created_by != v_caller AND NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.shared_packing_items
  SET deleted_at = NOW()
  WHERE id = p_item_id;
END;
$$;

----------------------------------------------------------------------
-- 3. claim_shared_packing_item
-- Any trip member can claim an unclaimed 'who_has' item.
-- Sets claimed_by and is_resolved = TRUE.
-- Auto-inserts a packing_item for the claimer under "Shared" category.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_shared_packing_item(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_trip_id   UUID;
  v_title     TEXT;
  v_item_type TEXT;
  v_claimed   UUID;
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

  -- Mark as claimed
  UPDATE public.shared_packing_items
  SET claimed_by = v_caller, is_resolved = TRUE
  WHERE id = p_item_id;

  -- Auto-add to claimer's private packing list under "Shared" category
  INSERT INTO public.packing_items (trip_id, user_id, category, title, source_shared_item_id)
  VALUES (v_trip_id, v_caller, 'Shared', v_title, p_item_id);
END;
$$;

----------------------------------------------------------------------
-- 4. copy_packing_list_to_trip
-- Copies all non-deleted packing items for auth.uid() from source trip
-- to target trip. Target trip must be planning or active.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.copy_packing_list_to_trip(
  p_source_trip_id UUID,
  p_target_trip_id UUID
)
RETURNS INT  -- number of items copied
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_target_status TEXT;
  v_copy_count  INT := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify membership in both trips
  IF NOT private.is_trip_member(p_source_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a member of source trip';
  END IF;

  IF NOT private.is_trip_member(p_target_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a member of target trip';
  END IF;

  -- Target trip must be planning or active
  SELECT status INTO v_target_status
  FROM public.trips
  WHERE id = p_target_trip_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target trip not found';
  END IF;

  IF v_target_status NOT IN ('planning', 'active') THEN
    RAISE EXCEPTION 'Target trip must be planning or active';
  END IF;

  -- Copy items
  INSERT INTO public.packing_items (trip_id, user_id, category, title, notes, sort_order)
  SELECT p_target_trip_id, v_caller, category, title, notes, sort_order
  FROM public.packing_items
  WHERE trip_id = p_source_trip_id
    AND user_id = v_caller
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_copy_count = ROW_COUNT;
  RETURN v_copy_count;
END;
$$;

----------------------------------------------------------------------
-- 5. resolve_lost_found_case
-- Creator or trip member can resolve a case.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_lost_found_case(p_case_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_trip_id    UUID;
  v_created_by UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, created_by INTO v_trip_id, v_created_by
  FROM public.lost_found_cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  IF NOT private.is_trip_member(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.lost_found_cases
  SET is_resolved = TRUE, resolved_at = NOW()
  WHERE id = p_case_id;
END;
$$;

----------------------------------------------------------------------
-- 6. delete_lost_found_case
-- Organizer or creator can hard-delete a case.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_lost_found_case(p_case_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_trip_id    UUID;
  v_created_by UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, created_by INTO v_trip_id, v_created_by
  FROM public.lost_found_cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  IF v_created_by != v_caller AND NOT private.is_trip_organizer(v_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM public.lost_found_cases WHERE id = p_case_id;
END;
$$;

----------------------------------------------------------------------
-- 7. TRIGGER: Notify on new Lost & Found case
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.notify_new_lost_found_case()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exclude UUID;
BEGIN
  -- If target_user IS NULL, notify all members (exclude creator)
  -- If target_user IS NOT NULL, notify only target_user (pass creator as exclude to create_trip_notification
  -- but then manually insert one row for target_user)
  IF NEW.target_user IS NULL THEN
    -- Broadcast to all members except creator
    PERFORM private.create_trip_notification(
      NEW.trip_id,
      NEW.created_by,
      'lost_found',
      'Lost & Found',
      NEW.title,
      'lost_found_case',
      NEW.id
    );
  ELSE
    -- Only notify the specific target_user
    INSERT INTO public.notifications (trip_id, user_id, type, title, body, related_type, related_id)
    VALUES (
      NEW.trip_id,
      NEW.target_user,
      'lost_found',
      'Lost & Found',
      NEW.title,
      'lost_found_case',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_lost_found_case
  AFTER INSERT ON public.lost_found_cases
  FOR EACH ROW EXECUTE FUNCTION private.notify_new_lost_found_case();

----------------------------------------------------------------------
-- 8. TRIGGER: Notify on shared_packing_items INSERT for 'everyone' and 'i_got_it'
-- Also auto-inserts private packing_items for affected users.
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.handle_shared_packing_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member RECORD;
BEGIN
  IF NEW.item_type = 'everyone' THEN
    -- Auto-add to every trip member's private packing list under "Shared"
    FOR v_member IN
      SELECT user_id FROM public.trip_members WHERE trip_id = NEW.trip_id
    LOOP
      INSERT INTO public.packing_items (trip_id, user_id, category, title, source_shared_item_id)
      VALUES (NEW.trip_id, v_member.user_id, 'Shared', NEW.title, NEW.id)
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Notify all members (including creator for awareness)
    PERFORM private.create_trip_notification(
      NEW.trip_id,
      '00000000-0000-0000-0000-000000000000'::UUID,  -- notify ALL
      'shared_packing',
      'Everyone brings: ' || NEW.title,
      NULL,
      'shared_packing_item',
      NEW.id
    );

  ELSIF NEW.item_type = 'i_got_it' THEN
    -- Auto-add to creator's private packing list under "Shared"
    INSERT INTO public.packing_items (trip_id, user_id, category, title, source_shared_item_id)
    VALUES (NEW.trip_id, NEW.created_by, 'Shared', NEW.title, NEW.id)
    ON CONFLICT DO NOTHING;

    -- Notify all other members
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
  -- 'who_has' items: no auto-insert, no immediate notification (notification on claim)

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_shared_packing_item_insert
  AFTER INSERT ON public.shared_packing_items
  FOR EACH ROW EXECUTE FUNCTION private.handle_shared_packing_item_insert();

----------------------------------------------------------------------
-- 9. TRIGGER: Notify original creator when a 'who_has' item is claimed
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.notify_shared_packing_item_claimed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only fire when claimed_by changes from NULL to non-NULL
  IF OLD.claimed_by IS NULL AND NEW.claimed_by IS NOT NULL THEN
    INSERT INTO public.notifications (trip_id, user_id, type, title, body, related_type, related_id)
    VALUES (
      NEW.trip_id,
      NEW.created_by,
      'shared_packing',
      'Item claimed',
      NEW.title,
      'shared_packing_item',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_shared_packing_item_claimed
  AFTER UPDATE ON public.shared_packing_items
  FOR EACH ROW EXECUTE FUNCTION private.notify_shared_packing_item_claimed();
