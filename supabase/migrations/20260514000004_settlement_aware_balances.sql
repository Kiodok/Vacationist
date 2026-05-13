-- Fix get_trip_balances to account for settlement status.
--
-- Previously: net_balance = total_paid - total_owed (ignores settlements)
-- Now:        net_balance = total_paid + settled_back - total_owed - received_settlements
--
-- When ower B settles a $50 split on payer A's expense:
--   B gets +$50 credit (paid their debt)
--   A gets -$50 debit  (received repayment, no longer owed)

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
  LEFT JOIN settled_to_payer stp ON stp.uid = m.user_id
  ORDER BY net_balance DESC;
END;
$$;
