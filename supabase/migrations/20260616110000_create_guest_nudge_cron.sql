-- Guest/participant conversion nudge cron job.
-- Runs daily at 12:00 UTC. Targets trip members with role 'participant' or
-- 'guest' whose trip ended exactly 1 day ago and who have never been an
-- organizer of any trip. Encourages them to create their own trip.
-- Dedup: one notification per user+trip (keyed by related_type='guest_nudge').

----------------------------------------------------------------------
-- private.create_guest_nudge_notifications()
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_guest_nudge_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rec   RECORD;
  v_count INT := 0;
BEGIN
  FOR v_rec IN
    SELECT tm.user_id, tm.trip_id, t.title AS trip_title
    FROM public.trip_members tm
    JOIN public.trips t ON t.id = tm.trip_id
    WHERE t.deleted_at IS NULL
      AND t.end_date = CURRENT_DATE - 1
      AND tm.role IN ('participant', 'guest')
      -- User has never been an organizer of any trip.
      AND NOT EXISTS (
        SELECT 1
        FROM public.trip_members tm2
        WHERE tm2.user_id = tm.user_id
          AND tm2.role    = 'organizer'
      )
      -- Dedup: no guest_nudge already sent for this user+trip.
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id      = tm.user_id
          AND n.trip_id      = tm.trip_id
          AND n.related_type = 'guest_nudge'
      )
  LOOP
    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body,
      related_type, related_id,
      context_entity, context_trip, context_creator
    ) VALUES (
      v_rec.trip_id,
      v_rec.user_id,
      'reminder',
      'Plan your own trip!',
      'You helped plan "' || v_rec.trip_title || '". Create your own trip — it''s free!',
      'guest_nudge',
      v_rec.trip_id,
      NULL,
      v_rec.trip_title,
      NULL
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- Schedule: daily at 12:00 UTC
----------------------------------------------------------------------
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'create-guest-nudge-notifications';

SELECT cron.schedule(
  'create-guest-nudge-notifications',
  '0 12 * * *',
  $$SELECT private.create_guest_nudge_notifications()$$
);
