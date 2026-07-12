-- Fix: trip_deleted was never added to notifications_type_check, causing a constraint
-- violation whenever soft_delete_trip tries to insert a notification row.
-- Also adds member_left for the upcoming member-removal notification feature.

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'new_activity', 'vote_update', 'expense_change', 'new_member',
    'schedule_change', 'reminder', 'vote_finalized', 'document_access_request',
    'lost_found', 'shared_packing', 'activity_note', 'expense_settlement',
    'trip_deleted', 'member_left'
  )
);
