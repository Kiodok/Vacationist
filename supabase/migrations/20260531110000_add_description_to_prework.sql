-- Add optional free-text description to prework_preferences.
-- Users can write a short note (e.g. "The first destination base is already selected, let's focus on the second base.")
-- that is shown at the top of their preferences entry.

ALTER TABLE public.prework_preferences
  ADD COLUMN description TEXT NULL;
