-- Multi-Topic Prework
--
-- Transforms the flat single-prework-per-trip model into a multi-topic system.
-- The organizer creates named topics (e.g. "Trip Type", "Location").
-- Each member distributes 100 credits per topic independently.
--
-- Changes:
--   1. Create public.prework_topics
--   2. Add topic_id FK to prework_preferences
--   3. Migrate existing data → default "General" topic per trip
--   4. Make topic_id NOT NULL, update UNIQUE constraint
--   5. Drop description from prework_preferences (moved to prework_topics)
--   6. SECURITY DEFINER RPCs: delete_prework_topic, reset_topic_preferences
--   7. Enable Realtime for prework_topics

----------------------------------------------------------------------
-- 1. PREWORK_TOPICS TABLE
----------------------------------------------------------------------

CREATE TABLE public.prework_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description   TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  seeded_labels TEXT[] NOT NULL DEFAULT '{}' CHECK (
    array_length(seeded_labels, 1) IS NULL OR array_length(seeded_labels, 1) <= 20
  ),
  position      INT NOT NULL DEFAULT 0,
  created_by    UUID NOT NULL REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.prework_topics ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER prework_topics_updated_at
  BEFORE UPDATE ON public.prework_topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

----------------------------------------------------------------------
-- 2. RLS FOR PREWORK_TOPICS
----------------------------------------------------------------------

-- SELECT: any trip member can see all topics for their trip
CREATE POLICY "prework_topics_select_member"
  ON public.prework_topics FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

-- INSERT: organizer only
CREATE POLICY "prework_topics_insert_organizer"
  ON public.prework_topics FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_organizer(trip_id, auth.uid())
  );

-- UPDATE: organizer only
CREATE POLICY "prework_topics_update_organizer"
  ON public.prework_topics FOR UPDATE TO authenticated
  USING (private.is_trip_organizer(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_organizer(trip_id, auth.uid()));

-- DELETE: denied — use delete_prework_topic RPC which is SECURITY DEFINER
-- (ON DELETE CASCADE to prework_preferences would be blocked by RLS otherwise)
CREATE POLICY "prework_topics_delete_deny"
  ON public.prework_topics FOR DELETE TO authenticated
  USING (false);

----------------------------------------------------------------------
-- 3. ADD topic_id TO prework_preferences (nullable for migration)
----------------------------------------------------------------------

ALTER TABLE public.prework_preferences
  ADD COLUMN topic_id UUID REFERENCES public.prework_topics(id) ON DELETE CASCADE;

----------------------------------------------------------------------
-- 4. MIGRATE EXISTING DATA
--    For each trip with existing prework_preferences, create a default
--    "General" topic and link all existing preference rows to it.
--    The organizer's description (if any) moves to the topic.
----------------------------------------------------------------------

DO $$
DECLARE
  v_trip_id     UUID;
  v_topic_id    UUID;
  v_description TEXT;
  v_created_by  UUID;
BEGIN
  FOR v_trip_id IN
    SELECT DISTINCT trip_id FROM public.prework_preferences
  LOOP
    -- Find the organizer's description to use as the topic description
    SELECT pp.description INTO v_description
    FROM public.prework_preferences pp
    JOIN public.trip_members tm
      ON tm.user_id = pp.user_id
      AND tm.trip_id = pp.trip_id
      AND tm.role = 'organizer'
    WHERE pp.trip_id = v_trip_id
      AND pp.description IS NOT NULL
      AND trim(pp.description) <> ''
    LIMIT 1;

    -- Find the organizer as the topic creator
    SELECT tm.user_id INTO v_created_by
    FROM public.trip_members tm
    WHERE tm.trip_id = v_trip_id AND tm.role = 'organizer'
    LIMIT 1;

    -- Fallback: use trip creator if no organizer member found
    IF v_created_by IS NULL THEN
      SELECT created_by INTO v_created_by
      FROM public.trips WHERE id = v_trip_id;
    END IF;

    -- Create the default topic
    INSERT INTO public.prework_topics
      (trip_id, title, description, position, created_by)
    VALUES
      (v_trip_id, 'General', v_description, 0, v_created_by)
    RETURNING id INTO v_topic_id;

    -- Link all existing preferences for this trip to the new topic
    UPDATE public.prework_preferences
    SET topic_id = v_topic_id
    WHERE trip_id = v_trip_id;
  END LOOP;
END;
$$;

----------------------------------------------------------------------
-- 5. FINALIZE SCHEMA CHANGES
----------------------------------------------------------------------

-- Make topic_id NOT NULL now that all rows are linked
ALTER TABLE public.prework_preferences
  ALTER COLUMN topic_id SET NOT NULL;

-- Replace UNIQUE(trip_id, user_id) → UNIQUE(topic_id, user_id)
ALTER TABLE public.prework_preferences
  DROP CONSTRAINT IF EXISTS prework_preferences_trip_id_user_id_key;

ALTER TABLE public.prework_preferences
  ADD CONSTRAINT prework_preferences_topic_id_user_id_key UNIQUE (topic_id, user_id);

-- Drop description from prework_preferences (moved to prework_topics)
ALTER TABLE public.prework_preferences
  DROP COLUMN IF EXISTS description;

-- Indexes
CREATE INDEX idx_prework_topics_trip_id
  ON public.prework_topics(trip_id);

CREATE INDEX idx_prework_preferences_topic_id
  ON public.prework_preferences(topic_id);

----------------------------------------------------------------------
-- 6. SECURITY DEFINER RPCs
----------------------------------------------------------------------

-- delete_prework_topic: hard-deletes the topic and all its preferences.
-- Uses SECURITY DEFINER so the cascade bypass is safe — otherwise the
-- RLS DELETE policy on prework_preferences (own rows only) would block
-- the cascade for other members' rows.
CREATE OR REPLACE FUNCTION public.delete_prework_topic(
  p_topic_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
BEGIN
  SELECT trip_id INTO v_trip_id
  FROM public.prework_topics
  WHERE id = p_topic_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the trip organizer can delete topics';
  END IF;

  -- Cascades to prework_preferences via ON DELETE CASCADE
  DELETE FROM public.prework_topics WHERE id = p_topic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_prework_topic(UUID) TO authenticated;

-- reset_topic_preferences: organizer-only bulk delete of all member
-- preferences for a single topic.
CREATE OR REPLACE FUNCTION public.reset_topic_preferences(
  p_topic_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
BEGIN
  SELECT trip_id INTO v_trip_id
  FROM public.prework_topics
  WHERE id = p_topic_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  IF NOT private.is_trip_organizer(v_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the trip organizer can reset topic preferences';
  END IF;

  DELETE FROM public.prework_preferences
  WHERE topic_id = p_topic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_topic_preferences(UUID) TO authenticated;

----------------------------------------------------------------------
-- 7. REALTIME
----------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.prework_topics;
ALTER TABLE public.prework_topics REPLICA IDENTITY FULL;
