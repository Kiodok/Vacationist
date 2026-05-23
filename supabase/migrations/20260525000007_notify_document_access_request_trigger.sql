-- Notification trigger for document_access_requests.
-- Separated from 20260522213024 because document_access_requests is created in 20260525000003.

CREATE OR REPLACE FUNCTION private.notify_document_access_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_title TEXT;
BEGIN
  SELECT title INTO v_trip_title
  FROM public.trips
  WHERE id = NEW.trip_id;

  PERFORM private.create_trip_notification(
    NEW.trip_id,
    NEW.requested_by,
    'document_access_request',
    'Document access requested',
    'The organizer of "' || COALESCE(v_trip_title, 'your trip') || '" has requested access to your travel documents.',
    'document_access_request',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_document_access_request ON public.document_access_requests;

CREATE TRIGGER trg_notify_document_access_request
  AFTER INSERT ON public.document_access_requests
  FOR EACH ROW EXECUTE FUNCTION private.notify_document_access_request();
