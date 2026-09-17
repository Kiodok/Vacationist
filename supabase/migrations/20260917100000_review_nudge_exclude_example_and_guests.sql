-- Growth Plan Q4 2026, Phase 2: the review nudge (cron + native review-sheet hook) was firing
-- on the auto-seeded example trip (create-example-trip sets a start_date ~3 months out, so it
-- eventually "ends" and both mechanisms treat it as a real completed trip) and on guest accounts,
-- who have no store account to leave a review from. Function-body replace only — no schema change.
-- Precedent: 20260817100000_review_nudge_store_neutral.sql. See engineering/supabase.md.

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
      AND is_example = false
      AND review_nudge_sent_at IS NULL
      AND end_date IS NOT NULL
      -- Trip ended at least 12 hours ago (end_date is a date, assume end of day UTC)
      AND (end_date::TIMESTAMP + INTERVAL '1 day' + INTERVAL '12 hours') < NOW()
  LOOP
    FOR v_member IN
      SELECT tm.user_id
      FROM public.trip_members tm
      JOIN public.users u ON u.id = tm.user_id
      WHERE tm.trip_id = v_trip.id
        AND u.is_guest = false
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
