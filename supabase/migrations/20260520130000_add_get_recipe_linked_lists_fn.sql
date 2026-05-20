-- Returns distinct shopping_list_ids that a recipe has been added to,
-- including lists where all items have been soft-deleted.
-- SECURITY DEFINER bypasses RLS (which filters out deleted_at IS NOT NULL rows).

CREATE OR REPLACE FUNCTION public.get_recipe_linked_lists(p_recipe_id UUID)
RETURNS TABLE(shopping_list_id UUID)
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT DISTINCT si.shopping_list_id
    FROM public.shopping_items si
   WHERE si.source_recipe_id = p_recipe_id;
$$;
