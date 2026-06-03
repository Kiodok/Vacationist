-- Make activity_notes.trip_id nullable so the BEFORE INSERT trigger can populate it
-- without requiring callers to pass a value. This matches the activity_votes pattern.
-- The trigger raises an exception if the parent activity is not found, so the column
-- will never actually contain NULL in practice.

ALTER TABLE public.activity_notes ALTER COLUMN trip_id DROP NOT NULL;
