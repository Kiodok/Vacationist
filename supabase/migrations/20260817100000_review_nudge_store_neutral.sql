-- Store-neutral review nudge (now sent to iOS App Store users too, not just Play Store).
-- Function body replace only — no schema change. See engineering/supabase.md.

CREATE OR REPLACE FUNCTION private.create_review_nudge_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip RECORD;
  v_member RECORD;
  v_count INT := 0;
BEGIN
  FOR v_trip IN
    SELECT id, title
    FROM public.trips
    WHERE deleted_at IS NULL
      AND review_nudge_sent_at IS NULL
      AND end_date IS NOT NULL
      -- Trip ended at least 12 hours ago (end_date is a date, assume end of day UTC)
      AND (end_date::TIMESTAMP + INTERVAL '1 day' + INTERVAL '12 hours') < NOW()
  LOOP
    FOR v_member IN
      SELECT user_id
      FROM public.trip_members
      WHERE trip_id = v_trip.id
    LOOP
      INSERT INTO public.notifications (
        trip_id, user_id, type, title, body,
        related_type, related_id,
        context_entity, context_trip, context_creator
      ) VALUES (
        v_trip.id,
        v_member.user_id,
        'reminder',
        'Enjoying Vacationist?',
        'Your trip is over — we''d love a quick rating!',
        'review_nudge',
        NULL,
        NULL,
        v_trip.title,
        NULL
      );

      v_count := v_count + 1;
    END LOOP;

    UPDATE public.trips
       SET review_nudge_sent_at = NOW()
     WHERE id = v_trip.id;
  END LOOP;

  RETURN v_count;
END;
$$;
