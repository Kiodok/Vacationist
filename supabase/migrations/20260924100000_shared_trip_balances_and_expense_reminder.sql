-- v1.39.1: the post-trip "…has unsettled expenses" reminder fired on a trip that was fully settled.
--
-- Root cause (confirmed against prod data, trip "Sarajevo", 2026-09-24): all 109 expense_splits were
-- status='settled', yet one member's net balance was exactly +0.01 — FX rounding residue (each split
-- is converted to the base currency with its own ROUND(), so on a foreign-currency expense the splits
-- can miss converted_amount by a cent or two; see 20260924120000 for the allocation fix). The app's
-- "All settled up" check (SettlementsModal → computeSettlements) needs BOTH a creditor and a debtor to
-- exist, so it correctly said "settled". The cron asked a different question — "is ANY member's net
-- non-zero?" — and fired on days 1, 3 and 7.
--
-- The same predicate bug also fires whenever a member leaves or deletes their account: their splits
-- are retained but their trip_members row is deleted, so the balance vector stops summing to zero.
--
-- Two hand-copied definitions of "settled" had drifted apart. This migration removes the copy:
--   1. private.trip_member_balances(trip) is now the ONE balance computation. It is the four CTEs
--      that were inlined in public.get_trip_balances, moved verbatim (same converted_amount /
--      settled-split arithmetic, same <0.01 → 0 zeroing, same ROUND(…, 2)).
--   2. public.get_trip_balances keeps its auth + membership guards and reads from it.
--   3. private.create_expense_reminders fires only when a creditor AND a debtor exist — the exact rule
--      of computeSettlements() in packages/utils/src/settlements.ts.
--
-- Also changed in create_expense_reminders (product decisions from the Tech Lead):
--   * only members who OWE or ARE OWED are notified (was: every member, even a square one);
--   * skips the auto-seeded example trip (is_example) — same fix the review nudge got on 2026-09-17;
--   * skips members who switched off `reminder` for the trip (previously only the push was gated, so
--     the in-app row + badge still appeared);
--   * dedups on related_type = 'expense_reminder' instead of body LIKE '%unsettled expenses%'
--     (an English-string match that breaks if a member clears notifications or the copy is translated).
--
-- Function bodies only — no schema change, no signature change. Precedents:
-- 20260809100007_fix_balance_rpcs_converted_amount.sql, 20260917100000_review_nudge_exclude_example_and_guests.sql.

----------------------------------------------------------------------
-- 1. private.trip_member_balances — the single balance computation
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.trip_member_balances(p_trip_id UUID)
RETURNS TABLE(user_id UUID, total_paid NUMERIC, total_owed NUMERIC, net_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id
      FROM public.trip_members tm
     WHERE tm.trip_id = p_trip_id
  ),
  paid AS (
    SELECT e.paid_by AS uid, COALESCE(SUM(e.converted_amount), 0) AS total
      FROM public.expenses e
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
     GROUP BY e.paid_by
  ),
  owed AS (
    SELECT es.user_id AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
     GROUP BY es.user_id
  ),
  settled_by_ower AS (
    SELECT es.user_id AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
       AND es.user_id != e.paid_by
       AND es.status = 'settled'
     GROUP BY es.user_id
  ),
  settled_to_payer AS (
    SELECT e.paid_by AS uid, COALESCE(SUM(es.amount_owed), 0) AS total
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
     WHERE e.trip_id = p_trip_id
       AND e.archived_at IS NULL
       AND es.user_id != e.paid_by
       AND es.status = 'settled'
     GROUP BY e.paid_by
  )
  SELECT
    m.user_id,
    ROUND(COALESCE(p.total, 0), 2)::NUMERIC AS total_paid,
    ROUND(COALESCE(o.total, 0), 2)::NUMERIC AS total_owed,
    CASE
      WHEN ABS(
        COALESCE(p.total, 0) + COALESCE(sbo.total, 0)
        - COALESCE(o.total, 0) - COALESCE(stp.total, 0)
      ) < 0.01 THEN 0::NUMERIC
      ELSE ROUND(
        COALESCE(p.total, 0) + COALESCE(sbo.total, 0)
        - COALESCE(o.total, 0) - COALESCE(stp.total, 0)
      , 2)::NUMERIC
    END AS net_balance
  FROM members m
  LEFT JOIN paid p ON p.uid = m.user_id
  LEFT JOIN owed o ON o.uid = m.user_id
  LEFT JOIN settled_by_ower sbo ON sbo.uid = m.user_id
  LEFT JOIN settled_to_payer stp ON stp.uid = m.user_id;
END;
$$;

----------------------------------------------------------------------
-- 2. public.get_trip_balances — same contract, now a thin guarded wrapper
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_trip_balances(p_trip_id UUID)
RETURNS TABLE(user_id UUID, total_paid NUMERIC, total_owed NUMERIC, net_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  RETURN QUERY
  SELECT b.user_id, b.total_paid, b.total_owed, b.net_balance
    FROM private.trip_member_balances(p_trip_id) b
   ORDER BY b.net_balance DESC;
END;
$$;

----------------------------------------------------------------------
-- 3. private.create_expense_reminders
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_expense_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip         RECORD;
  v_days         INT;
  v_title        TEXT;
  v_body         TEXT;
  v_count        INT := 0;
  v_inserted     INT;
  v_today        DATE := CURRENT_DATE;
  v_has_creditor BOOLEAN;
  v_has_debtor   BOOLEAN;
BEGIN
  FOR v_trip IN
    SELECT t.id, t.title, t.end_date
    FROM public.trips t
    WHERE t.deleted_at IS NULL
      AND t.is_example = false
      AND t.end_date < v_today
      AND (v_today - t.end_date) IN (1, 3, 7)
  LOOP
    v_days := v_today - v_trip.end_date;

    -- Already reminded today. related_type (not the English body) is the durable marker; rows written
    -- by the previous version of this function carry the same related_type, so history still counts.
    IF EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE trip_id      = v_trip.id
        AND type         = 'reminder'
        AND related_type = 'expense_reminder'
        AND created_at::date = v_today
      LIMIT 1
    ) THEN
      CONTINUE;
    END IF;

    -- "Unsettled" means somebody can still be asked to pay somebody: at least one creditor AND at
    -- least one debtor. Mirrors computeSettlements() (packages/utils/src/settlements.ts), which is
    -- what the Settlements modal uses to decide between "All settled up" and a list of payments.
    SELECT COALESCE(BOOL_OR(b.net_balance >= 0.01), FALSE),
           COALESCE(BOOL_OR(b.net_balance <= -0.01), FALSE)
      INTO v_has_creditor, v_has_debtor
      FROM private.trip_member_balances(v_trip.id) b;

    IF NOT (v_has_creditor AND v_has_debtor) THEN
      CONTINUE;
    END IF;

    v_title := 'Unsettled expenses: ' || v_trip.title;
    v_body  := '"' || v_trip.title || '" ended '
               || v_days
               || CASE WHEN v_days = 1 THEN ' day' ELSE ' days' END
               || ' ago and has unsettled expenses. Open the Expenses tab to settle up.';

    -- Only members who owe or are owed; respect the per-trip `reminder` toggle (a missing
    -- notification_preferences row means opted in). Delivery: the pg_cron push-dispatch poll picks up
    -- push_sent_at IS NULL rows, exactly like the planning/guest/review nudges.
    INSERT INTO public.notifications (
      trip_id, user_id, type, title, body,
      related_type, related_id,
      context_entity, context_trip, context_creator
    )
    SELECT
      v_trip.id, b.user_id, 'reminder', v_title, v_body,
      'expense_reminder', v_trip.id,
      NULL, v_trip.title, NULL
    FROM private.trip_member_balances(v_trip.id) b
    LEFT JOIN public.notification_preferences np
      ON np.user_id = b.user_id AND np.trip_id = v_trip.id
    WHERE b.net_balance <> 0
      AND COALESCE(np.reminder, TRUE);

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_count := v_count + v_inserted;
  END LOOP;

  RETURN v_count;
END;
$$;
