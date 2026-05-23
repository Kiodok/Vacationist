-- Denormalize member_count onto trips so getTrips() avoids a subquery-per-row.
-- A trigger keeps the counter in sync on INSERT/DELETE of trip_members.

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.trips t
SET member_count = (
  SELECT COUNT(*) FROM public.trip_members tm WHERE tm.trip_id = t.id
);

CREATE OR REPLACE FUNCTION private.maintain_trip_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.trips SET member_count = member_count + 1 WHERE id = NEW.trip_id;
    RETURN NEW;
  ELSE
    UPDATE public.trips SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.trip_id;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintain_trip_member_count ON public.trip_members;
CREATE TRIGGER trg_maintain_trip_member_count
  AFTER INSERT OR DELETE ON public.trip_members
  FOR EACH ROW
  EXECUTE FUNCTION private.maintain_trip_member_count();
