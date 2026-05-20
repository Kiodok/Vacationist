-- Add source_ingredient_id to shopping_items to track which recipe ingredient
-- each shopping item was created from. Enables auto-propagation of ingredient
-- changes to linked shopping lists.

ALTER TABLE public.shopping_items
  ADD COLUMN source_ingredient_id UUID DEFAULT NULL;

ALTER TABLE public.shopping_items
  ADD CONSTRAINT fk_shopping_items_source_ingredient
  FOREIGN KEY (source_ingredient_id) REFERENCES public.recipe_ingredients(id) ON DELETE SET NULL;

CREATE INDEX idx_shopping_items_source_ingredient_id
  ON public.shopping_items(source_ingredient_id)
  WHERE source_ingredient_id IS NOT NULL;
