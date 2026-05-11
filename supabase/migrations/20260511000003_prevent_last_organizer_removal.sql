-- Prevent removing the last organizer from a trip
CREATE OR REPLACE FUNCTION public.check_last_organizer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.role = 'organizer' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = OLD.trip_id
        AND role = 'organizer'
        AND id != OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot remove the last organizer from a trip';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_trip_member_delete
  BEFORE DELETE ON public.trip_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_last_organizer();

-- Also prevent demoting the last organizer via role update
CREATE OR REPLACE FUNCTION public.check_organizer_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.role = 'organizer' AND NEW.role != 'organizer' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = OLD.trip_id
        AND role = 'organizer'
        AND id != OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot demote the last organizer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_trip_member_role_change
  BEFORE UPDATE OF role ON public.trip_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_organizer_role_change();
