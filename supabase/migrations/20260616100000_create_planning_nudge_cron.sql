-- Biweekly planning nudge cron job.
-- Runs every Monday at 11:00 UTC. Notifies users whose most recent trip ended
-- 14+ days ago and who have no active or upcoming trips. Encourages them to
-- plan their next adventure.
-- Dedup: no planning_nudge sent to this user in the last 14 days.

----------------------------------------------------------------------
-- private.create_planning_nudge_notifications()
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_planning_nudge_notifications()
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
    -- Pick each user's most recently ended trip (must be 14+ days ago).
    SELECT DISTINCT ON (tm.user_id)
      tm.user_id,
      t.id    AS trip_id,
      t.title AS trip_title
    FROM public.trip_members tm
    JOIN public.trips t ON t.id = tm.trip_id
    WHERE t.deleted_at IS NULL
      AND t.end_date < CURRENT_DATE - INTERVAL '14 days'
      -- User has no trip that ended within the last 14 days or is still upcoming.
      -- (Ensures the user's MOST RECENT trip is truly 14+ days old.)
      AND NOT EXISTS (
        SELECT 1
        FROM public.trip_members tm2
        JOIN public.trips t2 ON t2.id = tm2.trip_id
        WHERE tm2.user_id = tm.user_id
          AND t2.deleted_at IS NULL
          AND t2.end_date >= CURRENT_DATE - INTERVAL '14 days'
      )
      -- Dedup: no planning_nudge sent to this user in the last 14 days.
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id       = tm.user_id
          AND n.related_type  = 'planning_nudge'
          AND n.created_at   >= NOW() - INTERVAL '14 days'
      )
    ORDER BY tm.user_id, t.end_date DESC
  LOOP
    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body,
      related_type, related_id,
      context_entity, context_trip, context_creator
    ) VALUES (
      v_rec.trip_id,
      v_rec.user_id,
      'reminder',
      'Ready for your next trip?',
      '"' || v_rec.trip_title || '" was great! Start planning your next adventure.',
      'planning_nudge',
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
-- Schedule: every Monday at 11:00 UTC
----------------------------------------------------------------------
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'create-planning-nudge-notifications';

SELECT cron.schedule(
  'create-planning-nudge-notifications',
  '0 11 * * 1',
  $$SELECT private.create_planning_nudge_notifications()$$
);
