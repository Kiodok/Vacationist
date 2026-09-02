-- v1.33.0 task 9: per-category expense totals, for the new donut chart in
-- Balances & Settlements. Same shape/conventions as get_trip_balances
-- (20260809100007_fix_balance_rpcs_converted_amount.sql): explicit auth + membership check,
-- SUM(converted_amount) (base-currency, frozen at write time) rather than raw `amount`, and the
-- same `archived_at IS NULL` filter used everywhere else "total trip spend" is computed.

CREATE OR REPLACE FUNCTION public.get_trip_expense_category_totals(p_trip_id UUID)
RETURNS TABLE(related_type TEXT, total NUMERIC)
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
  SELECT e.related_type, ROUND(SUM(e.converted_amount), 2)::NUMERIC AS total
    FROM public.expenses e
   WHERE e.trip_id = p_trip_id
     AND e.archived_at IS NULL
   GROUP BY e.related_type;
END;
$$;
