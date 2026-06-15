-- Post-trip expense reminder cron job.
-- Runs daily at 10:00 UTC (1 hour after trip-start reminders) and notifies all
-- members of recently completed trips that still have unsettled balances.
-- Reminders at days 1, 3, and 7 after end_date.
--
-- Uses type='reminder' (no schema change required) and related_type='expense_reminder'
-- so the mobile client can route the notification to the Expenses tab.

----------------------------------------------------------------------
-- private.create_expense_reminders()
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_expense_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip          RECORD;
  v_days          INT;
  v_title         TEXT;
  v_body          TEXT;
  v_count         INT := 0;
  v_today         DATE := CURRENT_DATE;
  v_has_unsettled BOOLEAN;
BEGIN
  FOR v_trip IN
    SELECT t.id, t.title, t.end_date
    FROM public.trips t
    WHERE t.deleted_at IS NULL
      AND t.end_date < v_today
      AND (v_today - t.end_date) IN (1, 3, 7)
  LOOP
    v_days := v_today - v_trip.end_date;

    -- Inline balance check. Cannot call get_trip_balances() here because
    -- auth.uid() is unavailable in pg_cron context.
    -- Logic mirrors the settlement-aware balance RPC.
    SELECT EXISTS (
      SELECT 1
      FROM (
        SELECT
          COALESCE(paid.total, 0)
          - COALESCE(owed.total, 0)
          + COALESCE(settled_for_me.total, 0)
          - COALESCE(settled_by_me.total, 0) AS net
        FROM public.trip_members tm
        LEFT JOIN (
          SELECT e.paid_by AS uid, SUM(e.amount) AS total
          FROM public.expenses e
          WHERE e.trip_id = v_trip.id AND e.archived_at IS NULL
          GROUP BY e.paid_by
        ) paid ON paid.uid = tm.user_id
        LEFT JOIN (
          SELECT es.user_id AS uid, SUM(es.amount_owed) AS total
          FROM public.expense_splits es
          JOIN public.expenses e ON e.id = es.expense_id
          WHERE e.trip_id = v_trip.id AND e.archived_at IS NULL
          GROUP BY es.user_id
        ) owed ON owed.uid = tm.user_id
        LEFT JOIN (
          SELECT es.user_id AS uid, SUM(es.amount_owed) AS total
          FROM public.expense_splits es
          JOIN public.expenses e ON e.id = es.expense_id
          WHERE e.trip_id = v_trip.id
            AND e.archived_at IS NULL
            AND es.user_id != e.paid_by
            AND es.status = 'settled'
          GROUP BY es.user_id
        ) settled_for_me ON settled_for_me.uid = tm.user_id
        LEFT JOIN (
          SELECT e.paid_by AS uid, SUM(es.amount_owed) AS total
          FROM public.expense_splits es
          JOIN public.expenses e ON e.id = es.expense_id
          WHERE e.trip_id = v_trip.id
            AND e.archived_at IS NULL
            AND es.user_id != e.paid_by
            AND es.status = 'settled'
          GROUP BY e.paid_by
        ) settled_by_me ON settled_by_me.uid = tm.user_id
        WHERE tm.trip_id = v_trip.id
      ) balances
      WHERE ABS(balances.net) >= 0.01
    ) INTO v_has_unsettled;

    IF NOT v_has_unsettled THEN
      CONTINUE;
    END IF;

    -- Dedup: skip if we already sent an expense reminder for this trip today.
    IF EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE trip_id    = v_trip.id
        AND type       = 'reminder'
        AND body LIKE  '%unsettled expenses%'
        AND created_at::date = v_today
      LIMIT 1
    ) THEN
      CONTINUE;
    END IF;

    v_title := 'Unsettled expenses: ' || v_trip.title;
    v_body  := '"' || v_trip.title || '" ended '
               || v_days
               || CASE WHEN v_days = 1 THEN ' day' ELSE ' days' END
               || ' ago and has unsettled expenses. Open the Expenses tab to settle up.';

    PERFORM private.create_trip_notification(
      v_trip.id,
      '00000000-0000-0000-0000-000000000000'::UUID, -- notify ALL members
      'reminder',
      v_title,
      v_body,
      'expense_reminder',   -- related_type used by client to route to Expenses tab
      v_trip.id,
      NULL::TEXT,           -- context_entity
      v_trip.title,         -- context_trip (used by push notification translation)
      NULL::TEXT            -- context_creator
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

----------------------------------------------------------------------
-- Schedule: daily at 10:00 UTC
----------------------------------------------------------------------
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'create-expense-reminders';

SELECT cron.schedule(
  'create-expense-reminders',
  '0 10 * * *',
  $$SELECT private.create_expense_reminders()$$
);
