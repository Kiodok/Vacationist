-- Phase 5a: Realtime Shopping Lists
--
-- Creates:
--   public.shopping_lists            – shopping lists per trip
--   public.shopping_items            – items within a shopping list (soft delete)
--   public.soft_delete_shopping_item – SECURITY DEFINER: organizer or participant-creator only
--   public.delete_shopping_list      – SECURITY DEFINER: organizer or list creator
--   trigger: restrict item update fields (guests can only change status/position)
--   Supabase Realtime enabled on shopping_items

----------------------------------------------------------------------
-- 1. SHOPPING_LISTS TABLE
----------------------------------------------------------------------

CREATE TABLE public.shopping_lists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (char_length(title) <= 100),
  created_by      UUID NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER shopping_lists_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: trip members can view lists
CREATE POLICY "shopping_lists_select_member"
  ON public.shopping_lists FOR SELECT TO authenticated
  USING (
    private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: any trip member can create lists
CREATE POLICY "shopping_lists_insert_member"
  ON public.shopping_lists FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: organizer or list creator
CREATE POLICY "shopping_lists_update_member"
  ON public.shopping_lists FOR UPDATE TO authenticated
  USING (
    private.is_trip_organizer(trip_id, auth.uid())
    OR created_by = auth.uid()
  )
  WITH CHECK (
    private.is_trip_organizer(trip_id, auth.uid())
    OR created_by = auth.uid()
  );

----------------------------------------------------------------------
-- 2. SHOPPING_ITEMS TABLE
----------------------------------------------------------------------

CREATE TABLE public.shopping_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id    UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  title               TEXT NOT NULL CHECK (char_length(title) <= 100),
  quantity            NUMERIC(10,2),
  unit                TEXT CHECK (unit IS NULL OR char_length(unit) <= 50),
  notes               TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  position            INT NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'bought')),
  source_recipe_id    UUID DEFAULT NULL,
  created_by          UUID NOT NULL REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER shopping_items_updated_at
  BEFORE UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: trip members can view non-deleted items
CREATE POLICY "shopping_items_select_member"
  ON public.shopping_items FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = shopping_list_id
        AND private.is_trip_member(sl.trip_id, auth.uid())
    )
  );

-- INSERT: any trip member can add items
CREATE POLICY "shopping_items_insert_member"
  ON public.shopping_items FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = shopping_list_id
        AND private.is_trip_member(sl.trip_id, auth.uid())
    )
  );

-- UPDATE: any trip member can update (status changes by all roles)
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
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = shopping_list_id
        AND private.is_trip_member(sl.trip_id, auth.uid())
    )
  );

----------------------------------------------------------------------
-- 3. RESTRICT ITEM UPDATE FIELDS
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_shopping_item_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
  v_role    TEXT;
BEGIN
  IF NEW.shopping_list_id IS DISTINCT FROM OLD.shopping_list_id THEN
    RAISE EXCEPTION 'Cannot change shopping_list_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  SELECT sl.trip_id INTO v_trip_id
    FROM public.shopping_lists sl
   WHERE sl.id = OLD.shopping_list_id;

  SELECT tm.role INTO v_role
    FROM public.trip_members tm
   WHERE tm.trip_id = v_trip_id AND tm.user_id = auth.uid();

  IF v_role = 'guest' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      RAISE EXCEPTION 'Guests cannot change item title';
    END IF;
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      RAISE EXCEPTION 'Guests cannot change item quantity';
    END IF;
    IF NEW.unit IS DISTINCT FROM OLD.unit THEN
      RAISE EXCEPTION 'Guests cannot change item unit';
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'Guests cannot change item notes';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_shopping_item_update_restrict
  BEFORE UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.restrict_shopping_item_update_fields();

----------------------------------------------------------------------
-- 4. SOFT DELETE SHOPPING ITEM (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_shopping_item(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id    UUID;
  v_created_by UUID;
  v_caller     UUID := auth.uid();
  v_role       TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT sl.trip_id, si.created_by
    INTO v_trip_id, v_created_by
    FROM public.shopping_items si
    JOIN public.shopping_lists sl ON sl.id = si.shopping_list_id
   WHERE si.id = p_item_id AND si.deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  SELECT tm.role INTO v_role
    FROM public.trip_members tm
   WHERE tm.trip_id = v_trip_id AND tm.user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  IF v_role = 'organizer' THEN
    NULL;
  ELSIF v_role = 'participant' AND v_created_by = v_caller THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.shopping_items
     SET deleted_at = NOW()
   WHERE id = p_item_id;
END;
$$;

----------------------------------------------------------------------
-- 5. DELETE SHOPPING LIST (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_shopping_list(p_list_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id    UUID;
  v_created_by UUID;
  v_caller     UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, created_by
    INTO v_trip_id, v_created_by
    FROM public.shopping_lists
   WHERE id = p_list_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Shopping list not found';
  END IF;

  IF NOT (
    private.is_trip_organizer(v_trip_id, v_caller)
    OR v_created_by = v_caller
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM public.shopping_lists WHERE id = p_list_id;
END;
$$;

----------------------------------------------------------------------
-- 6. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_shopping_lists_trip_id ON public.shopping_lists(trip_id);
CREATE INDEX idx_shopping_items_list_id ON public.shopping_items(shopping_list_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shopping_items_status ON public.shopping_items(status) WHERE deleted_at IS NULL;

----------------------------------------------------------------------
-- 7. ENABLE SUPABASE REALTIME
----------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
