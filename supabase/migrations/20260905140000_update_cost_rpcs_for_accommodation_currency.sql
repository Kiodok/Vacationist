-- v1.34.0 item 12 extension: now that accommodations has its own `currency` column
-- (20260905130000), get_trip_cost_summary and get_my_trip_cost_shares must emit/group the
-- accommodation row by that column instead of the trip's base_currency — identical treatment to
-- what these two functions already do for transfer_rental/transfer_public_transport rows.
-- v_base_currency / mt.base_currency stay declared/selected — still used by the activity and
-- expense_* rows, which have no currency column of their own.

CREATE OR REPLACE FUNCTION public.get_trip_cost_summary(p_trip_id UUID)
RETURNS TABLE(source TEXT, currency TEXT, amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_base_currency TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  SELECT t.base_currency INTO v_base_currency FROM public.trips t WHERE t.id = p_trip_id;

  RETURN QUERY
  SELECT 'accommodation'::TEXT, a.currency, ROUND(SUM(a.price_total), 2)::NUMERIC
    FROM public.accommodations a
   WHERE a.trip_id = p_trip_id
     AND a.deleted_at IS NULL
     AND a.status IN ('reserved', 'booked', 'completed')
     AND a.price_total IS NOT NULL
   GROUP BY a.currency

  UNION ALL
  SELECT 'transfer_flight'::TEXT, f.currency, ROUND(SUM(f.price_per_person * COALESCE(pc.passenger_count, 0)), 2)::NUMERIC
    FROM public.transfer_flights f
    LEFT JOIN (
      SELECT flight_id, COUNT(*) AS passenger_count
        FROM public.transfer_flight_passengers
       GROUP BY flight_id
    ) pc ON pc.flight_id = f.id
   WHERE f.trip_id = p_trip_id
     AND f.deleted_at IS NULL
     AND f.status IN ('booked', 'completed')
     AND f.price_per_person IS NOT NULL
   GROUP BY f.currency

  UNION ALL
  SELECT 'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC
    FROM public.transfer_rentals r
   WHERE r.trip_id = p_trip_id
     AND r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
   GROUP BY r.currency

  UNION ALL
  SELECT 'transfer_public_transport'::TEXT, pt.currency, ROUND(SUM(pt.price_total), 2)::NUMERIC
    FROM public.transfer_public_transport pt
   WHERE pt.trip_id = p_trip_id
     AND pt.deleted_at IS NULL
     AND pt.price_total IS NOT NULL
   GROUP BY pt.currency

  UNION ALL
  SELECT 'activity'::TEXT, v_base_currency, ROUND(SUM(act.cost_estimate), 2)::NUMERIC
    FROM public.activities act
   WHERE act.trip_id = p_trip_id
     AND act.deleted_at IS NULL
     AND act.status IN ('reserved', 'completed')
     AND act.cost_estimate IS NOT NULL
   GROUP BY v_base_currency

  UNION ALL
  SELECT 'expense_' || e.related_type, v_base_currency, ROUND(SUM(e.converted_amount), 2)::NUMERIC
    FROM public.expenses e
   WHERE e.trip_id = p_trip_id
     AND e.archived_at IS NULL
   GROUP BY e.related_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_trip_cost_shares()
RETURNS TABLE(
  trip_id UUID,
  trip_title TEXT,
  start_date DATE,
  member_count INT,
  source TEXT,
  currency TEXT,
  amount NUMERIC,
  is_my_flight BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH my_trips AS (
    SELECT t.id AS trip_id, t.title AS trip_title, t.start_date, t.base_currency,
           (SELECT COUNT(*)::INT FROM public.trip_members tm WHERE tm.trip_id = t.id) AS member_count
      FROM public.trips t
     WHERE t.deleted_at IS NULL
       AND private.is_trip_member(t.id, v_user_id)
  )
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'accommodation'::TEXT, a.currency, ROUND(SUM(a.price_total), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.accommodations a
    JOIN my_trips mt ON mt.trip_id = a.trip_id
   WHERE a.deleted_at IS NULL
     AND a.status IN ('reserved', 'booked', 'completed')
     AND a.price_total IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, a.currency

  UNION ALL
  -- One row per flight (not aggregated) — is_my_flight needs per-flight passenger membership.
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_flight'::TEXT, f.currency, f.price_per_person, (fp.user_id IS NOT NULL)
    FROM public.transfer_flights f
    JOIN my_trips mt ON mt.trip_id = f.trip_id
    LEFT JOIN public.transfer_flight_passengers fp ON fp.flight_id = f.id AND fp.user_id = v_user_id
   WHERE f.deleted_at IS NULL
     AND f.status IN ('booked', 'completed')
     AND f.price_per_person IS NOT NULL

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_rental'::TEXT, r.currency, ROUND(SUM(r.price_total), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.transfer_rentals r
    JOIN my_trips mt ON mt.trip_id = r.trip_id
   WHERE r.deleted_at IS NULL
     AND r.price_total IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, r.currency

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'transfer_public_transport'::TEXT, pt.currency, ROUND(SUM(pt.price_total), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.transfer_public_transport pt
    JOIN my_trips mt ON mt.trip_id = pt.trip_id
   WHERE pt.deleted_at IS NULL
     AND pt.price_total IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, pt.currency

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'activity'::TEXT, mt.base_currency, ROUND(SUM(act.cost_estimate), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.activities act
    JOIN my_trips mt ON mt.trip_id = act.trip_id
   WHERE act.deleted_at IS NULL
     AND act.status IN ('reserved', 'completed')
     AND act.cost_estimate IS NOT NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, mt.base_currency

  UNION ALL
  SELECT mt.trip_id, mt.trip_title, mt.start_date, mt.member_count,
         'expense_owed_by_me'::TEXT, mt.base_currency, ROUND(SUM(es.amount_owed), 2)::NUMERIC, NULL::BOOLEAN
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
    JOIN my_trips mt ON mt.trip_id = e.trip_id
   WHERE es.user_id = v_user_id
     AND e.archived_at IS NULL
   GROUP BY mt.trip_id, mt.trip_title, mt.start_date, mt.member_count, mt.base_currency;
END;
$$;
