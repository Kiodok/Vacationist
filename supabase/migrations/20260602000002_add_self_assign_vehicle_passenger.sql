-- join_vehicle(p_vehicle_id): any trip member can add themselves as a passenger.
-- Idempotent — ON CONFLICT DO NOTHING means calling it twice is safe.
CREATE OR REPLACE FUNCTION public.join_vehicle(
  p_vehicle_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
BEGIN
  SELECT trip_id INTO v_trip_id
  FROM public.transfer_vehicles
  WHERE id = p_vehicle_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  IF NOT private.is_trip_member(v_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  INSERT INTO public.transfer_vehicle_passengers (vehicle_id, user_id, is_driver)
  VALUES (p_vehicle_id, auth.uid(), false)
  ON CONFLICT (vehicle_id, user_id) DO NOTHING;
END;
$$;

-- leave_vehicle(p_vehicle_id): any trip member can remove themselves as a passenger.
CREATE OR REPLACE FUNCTION public.leave_vehicle(
  p_vehicle_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_id UUID;
BEGIN
  SELECT trip_id INTO v_trip_id
  FROM public.transfer_vehicles
  WHERE id = p_vehicle_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  IF NOT private.is_trip_member(v_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  DELETE FROM public.transfer_vehicle_passengers
  WHERE vehicle_id = p_vehicle_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_vehicle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_vehicle(UUID) TO authenticated;
