-- Enable realtime on recipe_ingredients so ingredient changes propagate to all users
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_ingredients;
