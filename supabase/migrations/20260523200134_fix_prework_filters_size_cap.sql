-- Security fix: prework_preferences.filters JSONB only checked that the value
-- is an array (jsonb_typeof = 'array') but had no element count limit.
-- An attacker could store an unbounded array, causing large row sizes and
-- slow reads for all trip members.
-- Fix: add a CHECK constraint capping the array at 20 elements.

ALTER TABLE public.prework_preferences
  ADD CONSTRAINT prework_filters_max_elements
  CHECK (jsonb_array_length(filters) <= 20);
