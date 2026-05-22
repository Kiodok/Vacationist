-- Denormalize trip_id to child tables for Supabase Realtime server-side filtering.
--
-- Background: Supabase Realtime postgres_changes only supports `filter: 'column=eq.value'`
-- on a column that exists DIRECTLY on the subscribed table. The child tables below
-- (votes, passengers, splits, shopping items) previously had no trip_id column,
-- so their realtime subscriptions had no filter — delivering all events to all subscribers.
--
-- Fix: Add a denormalized trip_id column to each table so subscriptions can use
-- `filter: trip_id=eq.${tripId}`, limiting fan-out to members of that trip only.
--
-- Each table gets:
--   1. Nullable trip_id column added
--   2. Existing rows backfilled via JOIN to parent table
--   3. NOT NULL constraint applied
--   4. Index on trip_id
--   5. BEFORE INSERT trigger to auto-populate trip_id from the parent row

----------------------------------------------------------------------
-- 1. ACTIVITY_VOTES
----------------------------------------------------------------------

ALTER TABLE public.activity_votes
  ADD COLUMN trip_id UUID REFERENCES public.trips(id);

UPDATE public.activity_votes av
   SET trip_id = a.trip_id
  FROM public.activities a
 WHERE av.activity_id = a.id;

ALTER TABLE public.activity_votes
  ALTER COLUMN trip_id SET NOT NULL;

CREATE INDEX idx_activity_votes_trip_id ON public.activity_votes(trip_id);

CREATE OR REPLACE FUNCTION public.set_activity_vote_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT a.trip_id INTO NEW.trip_id
    FROM public.activities a
   WHERE a.id = NEW.activity_id;
  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent activity not found for activity_vote';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_activity_vote_trip_id
  BEFORE INSERT ON public.activity_votes
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_vote_trip_id();

----------------------------------------------------------------------
-- 2. ACCOMMODATION_VOTES
----------------------------------------------------------------------

ALTER TABLE public.accommodation_votes
  ADD COLUMN trip_id UUID REFERENCES public.trips(id);

UPDATE public.accommodation_votes av
   SET trip_id = a.trip_id
  FROM public.accommodations a
 WHERE av.accommodation_id = a.id;

ALTER TABLE public.accommodation_votes
  ALTER COLUMN trip_id SET NOT NULL;

CREATE INDEX idx_accommodation_votes_trip_id ON public.accommodation_votes(trip_id);

CREATE OR REPLACE FUNCTION public.set_accommodation_vote_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT a.trip_id INTO NEW.trip_id
    FROM public.accommodations a
   WHERE a.id = NEW.accommodation_id;
  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent accommodation not found for accommodation_vote';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_accommodation_vote_trip_id
  BEFORE INSERT ON public.accommodation_votes
  FOR EACH ROW EXECUTE FUNCTION public.set_accommodation_vote_trip_id();

----------------------------------------------------------------------
-- 3. TRANSFER_FLIGHT_VOTES
----------------------------------------------------------------------

ALTER TABLE public.transfer_flight_votes
  ADD COLUMN trip_id UUID REFERENCES public.trips(id);

UPDATE public.transfer_flight_votes tfv
   SET trip_id = f.trip_id
  FROM public.transfer_flights f
 WHERE tfv.flight_id = f.id;

ALTER TABLE public.transfer_flight_votes
  ALTER COLUMN trip_id SET NOT NULL;

CREATE INDEX idx_transfer_flight_votes_trip_id ON public.transfer_flight_votes(trip_id);

CREATE OR REPLACE FUNCTION public.set_transfer_flight_vote_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT f.trip_id INTO NEW.trip_id
    FROM public.transfer_flights f
   WHERE f.id = NEW.flight_id;
  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent flight not found for transfer_flight_vote';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_transfer_flight_vote_trip_id
  BEFORE INSERT ON public.transfer_flight_votes
  FOR EACH ROW EXECUTE FUNCTION public.set_transfer_flight_vote_trip_id();

----------------------------------------------------------------------
-- 4. TRANSFER_FLIGHT_PASSENGERS
----------------------------------------------------------------------

ALTER TABLE public.transfer_flight_passengers
  ADD COLUMN trip_id UUID REFERENCES public.trips(id);

UPDATE public.transfer_flight_passengers tfp
   SET trip_id = f.trip_id
  FROM public.transfer_flights f
 WHERE tfp.flight_id = f.id;

ALTER TABLE public.transfer_flight_passengers
  ALTER COLUMN trip_id SET NOT NULL;

CREATE INDEX idx_transfer_flight_passengers_trip_id ON public.transfer_flight_passengers(trip_id);

CREATE OR REPLACE FUNCTION public.set_transfer_flight_passenger_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT f.trip_id INTO NEW.trip_id
    FROM public.transfer_flights f
   WHERE f.id = NEW.flight_id;
  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent flight not found for transfer_flight_passenger';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_transfer_flight_passenger_trip_id
  BEFORE INSERT ON public.transfer_flight_passengers
  FOR EACH ROW EXECUTE FUNCTION public.set_transfer_flight_passenger_trip_id();

----------------------------------------------------------------------
-- 5. TRANSFER_VEHICLE_PASSENGERS
----------------------------------------------------------------------

ALTER TABLE public.transfer_vehicle_passengers
  ADD COLUMN trip_id UUID REFERENCES public.trips(id);

UPDATE public.transfer_vehicle_passengers tvp
   SET trip_id = v.trip_id
  FROM public.transfer_vehicles v
 WHERE tvp.vehicle_id = v.id;

ALTER TABLE public.transfer_vehicle_passengers
  ALTER COLUMN trip_id SET NOT NULL;

CREATE INDEX idx_transfer_vehicle_passengers_trip_id ON public.transfer_vehicle_passengers(trip_id);

CREATE OR REPLACE FUNCTION public.set_transfer_vehicle_passenger_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT v.trip_id INTO NEW.trip_id
    FROM public.transfer_vehicles v
   WHERE v.id = NEW.vehicle_id;
  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent vehicle not found for transfer_vehicle_passenger';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_transfer_vehicle_passenger_trip_id
  BEFORE INSERT ON public.transfer_vehicle_passengers
  FOR EACH ROW EXECUTE FUNCTION public.set_transfer_vehicle_passenger_trip_id();

----------------------------------------------------------------------
-- 6. EXPENSE_SPLITS
----------------------------------------------------------------------

ALTER TABLE public.expense_splits
  ADD COLUMN trip_id UUID REFERENCES public.trips(id);

UPDATE public.expense_splits es
   SET trip_id = e.trip_id
  FROM public.expenses e
 WHERE es.expense_id = e.id;

ALTER TABLE public.expense_splits
  ALTER COLUMN trip_id SET NOT NULL;

CREATE INDEX idx_expense_splits_trip_id ON public.expense_splits(trip_id);

CREATE OR REPLACE FUNCTION public.set_expense_split_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT e.trip_id INTO NEW.trip_id
    FROM public.expenses e
   WHERE e.id = NEW.expense_id;
  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent expense not found for expense_split';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_expense_split_trip_id
  BEFORE INSERT ON public.expense_splits
  FOR EACH ROW EXECUTE FUNCTION public.set_expense_split_trip_id();

----------------------------------------------------------------------
-- 7. SHOPPING_ITEMS
----------------------------------------------------------------------

ALTER TABLE public.shopping_items
  ADD COLUMN trip_id UUID REFERENCES public.trips(id);

UPDATE public.shopping_items si
   SET trip_id = sl.trip_id
  FROM public.shopping_lists sl
 WHERE si.shopping_list_id = sl.id;

ALTER TABLE public.shopping_items
  ALTER COLUMN trip_id SET NOT NULL;

CREATE INDEX idx_shopping_items_trip_id ON public.shopping_items(trip_id);

CREATE OR REPLACE FUNCTION public.set_shopping_item_trip_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT sl.trip_id INTO NEW.trip_id
    FROM public.shopping_lists sl
   WHERE sl.id = NEW.shopping_list_id;
  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'Parent shopping list not found for shopping_item';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_shopping_item_trip_id
  BEFORE INSERT ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.set_shopping_item_trip_id();

-- REPLICA IDENTITY FULL required so DELETE event payloads include trip_id for filtering.
-- (All other 6 tables already have REPLICA IDENTITY FULL from prior migrations.)
ALTER TABLE public.shopping_items REPLICA IDENTITY FULL;

-- Also block trip_id mutation in the existing update guard trigger.
CREATE OR REPLACE FUNCTION public.restrict_shopping_item_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
  v_role    TEXT;
BEGIN
  IF NEW.shopping_list_id IS DISTINCT FROM OLD.shopping_list_id THEN
    RAISE EXCEPTION 'Cannot change shopping_list_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;

  SELECT sl.trip_id INTO v_trip_id
    FROM public.shopping_lists sl
   WHERE sl.id = OLD.shopping_list_id;

  SELECT tm.role INTO v_role
    FROM public.trip_members tm
   WHERE tm.trip_id = v_trip_id AND tm.user_id = auth.uid();

  IF v_role = 'guest' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      RAISE EXCEPTION 'Guests cannot change item title';
    END IF;
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      RAISE EXCEPTION 'Guests cannot change item quantity';
    END IF;
    IF NEW.unit IS DISTINCT FROM OLD.unit THEN
      RAISE EXCEPTION 'Guests cannot change item unit';
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'Guests cannot change item notes';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
