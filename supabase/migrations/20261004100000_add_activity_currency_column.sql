-- v1.39.4: per-entity currency for Activities, closing the last gap in the item-12 currency work.
-- Same reasoning as 20260904130000_add_transfer_currency_columns.sql and
-- 20260905130000_add_accommodation_currency_column.sql: activities.cost_estimate was always
-- displayed using the trip's LIVE base_currency, because the table had no currency column of its
-- own. Changing a trip's currency after the fact would silently reinterpret an already-estimated
-- activity cost with no conversion. This does NOT change the deliberate, unrelated exclusion of
-- activities.cost_estimate from the cost-analysis RPCs (get_trip_cost_summary /
-- get_my_trip_cost_shares) — that exclusion is because it's a rough planning number, not a
-- committed cost, and is independent of which currency it's denominated in.
--
-- Backfill: every existing row's cost estimate was always implicitly denominated in whatever the
-- trip's base_currency was AT THE TIME — the trip's CURRENT base_currency is the best available
-- approximation for historical rows, same non-destructive backfill-then-NOT-NULL pattern as the
-- two prior currency migrations.

ALTER TABLE public.activities
  ADD COLUMN currency TEXT REFERENCES public.currency_catalog(code);

UPDATE public.activities a
   SET currency = t.base_currency
  FROM public.trips t
 WHERE a.trip_id = t.id
   AND a.currency IS NULL;

ALTER TABLE public.activities ALTER COLUMN currency SET NOT NULL;

-- Unlike Accommodation (a direct client-side .insert()), activity creation goes through the
-- create_activity RPC — DROP + CREATE required because Postgres forbids changing a function's
-- signature via CREATE OR REPLACE (same dance as the reservation_required/auto_close/
-- documents_enabled additions to this same function).
DROP FUNCTION IF EXISTS public.create_activity(UUID, TEXT, TEXT, TEXT, NUMERIC, DATE, TIME, TIME, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE FUNCTION public.create_activity(
  p_trip_id               UUID,
  p_title                 TEXT,
  p_description           TEXT    DEFAULT NULL,
  p_category              TEXT    DEFAULT NULL,
  p_cost_estimate         NUMERIC DEFAULT NULL,
  p_activity_date         DATE    DEFAULT NULL,
  p_start_time            TIME    DEFAULT NULL,
  p_end_time              TIME    DEFAULT NULL,
  p_external_url          TEXT    DEFAULT NULL,
  p_maps_url              TEXT    DEFAULT NULL,
  p_reservation_required  BOOLEAN DEFAULT FALSE,
  p_auto_close            BOOLEAN DEFAULT FALSE,
  p_documents_enabled     BOOLEAN DEFAULT FALSE,
  p_currency              TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_id       UUID;
  v_currency TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  -- Defensive fallback only — the client always sends p_currency explicitly (same client/
  -- migration deploy), but this keeps the NOT NULL constraint safe against any stale caller.
  v_currency := COALESCE(p_currency, (SELECT base_currency FROM public.trips WHERE id = p_trip_id));

  INSERT INTO public.activities (
    trip_id, title, description, category, cost_estimate,
    activity_date, start_time, end_time, external_url, maps_url,
    reservation_required, auto_close, documents_enabled, currency, created_by
  )
  VALUES (
    p_trip_id, p_title, p_description, p_category, p_cost_estimate,
    p_activity_date, p_start_time, p_end_time, p_external_url, p_maps_url,
    p_reservation_required, p_auto_close, p_documents_enabled, v_currency, v_caller
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
