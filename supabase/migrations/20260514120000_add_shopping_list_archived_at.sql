-- Add archived_at to shopping_lists for section grouping (Active / Completed / Archived)
ALTER TABLE public.shopping_lists
  ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL;
