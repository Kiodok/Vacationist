-- Per-member balance calculation for a trip.
-- Returns total_paid, total_owed, and net_balance for each trip member.
-- Positive net_balance = others owe them. Negative = they owe others.

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
  WITH members AS (
    SELECT tm.user_id
      FROM public.trip_members tm
     WHERE tm.trip_id = p_trip_id
  ),
  paid AS (
    SELECT e.paid_by AS uid, COALESCE(SUM(e.amount), 0) AS total
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
  )
  SELECT
    m.user_id,
    COALESCE(p.total, 0)::NUMERIC AS total_paid,
    COALESCE(o.total, 0)::NUMERIC AS total_owed,
    (COALESCE(p.total, 0) - COALESCE(o.total, 0))::NUMERIC AS net_balance
  FROM members m
  LEFT JOIN paid p ON p.uid = m.user_id
  LEFT JOIN owed o ON o.uid = m.user_id
  ORDER BY net_balance DESC;
END;
$$;
