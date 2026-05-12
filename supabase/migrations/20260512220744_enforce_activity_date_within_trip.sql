-- Enforce that activity_date falls within the parent trip's start_date..end_date range.
-- Covers INSERT and UPDATE; NULL activity_date is allowed (no date set yet).

CREATE OR REPLACE FUNCTION public.check_activity_date_within_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_start_date DATE;
  v_end_date   DATE;
BEGIN
  IF NEW.activity_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.start_date, t.end_date
    INTO v_start_date, v_end_date
    FROM public.trips t
   WHERE t.id = NEW.trip_id;

  IF NEW.activity_date < v_start_date OR NEW.activity_date > v_end_date THEN
    RAISE EXCEPTION 'activity_date must be between trip start_date (%) and end_date (%)',
      v_start_date, v_end_date;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_activity_date_check
  BEFORE INSERT OR UPDATE OF activity_date ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.check_activity_date_within_trip();
