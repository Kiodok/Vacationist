-- Phase 6: Recipes
--
-- Creates:
--   public.recipes              – recipes per trip (hard delete)
--   public.recipe_ingredients   – ingredients within a recipe (hard delete, CASCADE)
--   public.delete_recipe        – SECURITY DEFINER: organizer or recipe creator
--   trigger: restrict recipe update fields (guests cannot edit)
--   FK constraint on shopping_items.source_recipe_id → recipes(id) ON DELETE SET NULL
--   Supabase Realtime enabled on recipes

----------------------------------------------------------------------
-- 1. RECIPES TABLE
----------------------------------------------------------------------

CREATE TABLE public.recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (char_length(title) <= 100),
  description     TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  servings        INT NOT NULL DEFAULT 4 CHECK (servings > 0),
  created_by      UUID NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: trip members can view recipes
CREATE POLICY "recipes_select_member"
  ON public.recipes FOR SELECT TO authenticated
  USING (
    private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: any trip member can create recipes
CREATE POLICY "recipes_insert_member"
  ON public.recipes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: organizer or recipe creator
CREATE POLICY "recipes_update_member"
  ON public.recipes FOR UPDATE TO authenticated
  USING (
    private.is_trip_organizer(trip_id, auth.uid())
    OR created_by = auth.uid()
  )
  WITH CHECK (
    private.is_trip_organizer(trip_id, auth.uid())
    OR created_by = auth.uid()
  );

----------------------------------------------------------------------
-- 2. RECIPE_INGREDIENTS TABLE
----------------------------------------------------------------------

CREATE TABLE public.recipe_ingredients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id       UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (char_length(title) <= 100),
  quantity        NUMERIC(10,2) CHECK (quantity IS NULL OR quantity >= 0),
  unit            TEXT CHECK (unit IS NULL OR char_length(unit) <= 50),
  sort_order      INT NOT NULL DEFAULT 0
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- SELECT: trip members can view ingredients (via recipes → trips)
CREATE POLICY "recipe_ingredients_select_member"
  ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_id
        AND private.is_trip_member(r.trip_id, auth.uid())
    )
  );

-- INSERT: any trip member can add ingredients
CREATE POLICY "recipe_ingredients_insert_member"
  ON public.recipe_ingredients FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_id
        AND private.is_trip_member(r.trip_id, auth.uid())
    )
  );

-- UPDATE: organizer or recipe creator
CREATE POLICY "recipe_ingredients_update_member"
  ON public.recipe_ingredients FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_id
        AND (private.is_trip_organizer(r.trip_id, auth.uid()) OR r.created_by = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_id
        AND (private.is_trip_organizer(r.trip_id, auth.uid()) OR r.created_by = auth.uid())
    )
  );

-- DELETE: organizer or recipe creator
CREATE POLICY "recipe_ingredients_delete_member"
  ON public.recipe_ingredients FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_id
        AND (private.is_trip_organizer(r.trip_id, auth.uid()) OR r.created_by = auth.uid())
    )
  );

----------------------------------------------------------------------
-- 3. RESTRICT RECIPE UPDATE FIELDS (guests cannot edit)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_recipe_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  SELECT tm.role INTO v_role
    FROM public.trip_members tm
   WHERE tm.trip_id = OLD.trip_id AND tm.user_id = auth.uid();

  IF v_role = 'guest' THEN
    RAISE EXCEPTION 'Guests cannot edit recipes';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_recipe_update_restrict
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.restrict_recipe_update_fields();

----------------------------------------------------------------------
-- 4. DELETE RECIPE (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_recipe(p_recipe_id UUID)
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
    FROM public.recipes
   WHERE id = p_recipe_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Recipe not found';
  END IF;

  IF NOT (
    private.is_trip_organizer(v_trip_id, v_caller)
    OR v_created_by = v_caller
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM public.recipes WHERE id = p_recipe_id;
END;
$$;

----------------------------------------------------------------------
-- 5. FK CONSTRAINT: shopping_items.source_recipe_id → recipes(id)
----------------------------------------------------------------------

ALTER TABLE public.shopping_items
  ADD CONSTRAINT fk_shopping_items_source_recipe
  FOREIGN KEY (source_recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;

----------------------------------------------------------------------
-- 6. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_recipes_trip_id ON public.recipes(trip_id);
CREATE INDEX idx_recipe_ingredients_recipe_id ON public.recipe_ingredients(recipe_id);

----------------------------------------------------------------------
-- 7. ENABLE SUPABASE REALTIME
----------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;
