-- Enable Supabase Realtime for the notifications table so that
-- useNotificationsRealtime() receives INSERT/UPDATE/DELETE events.
--
-- Without this, the notifications table is not in the supabase_realtime
-- publication and the client-side Realtime subscription fires no events.
-- New notifications created by DB triggers are stored in the DB (in-app
-- notification bell shows them on next refetch), but the real-time cache
-- update in useNotificationsRealtime.onInsert never executes, making
-- new notifications appear "sometimes missing" until the user manually
-- pulls to refresh.
--
-- REPLICA IDENTITY FULL is required so that:
--   1. DELETE events include all columns (not just the PK), enabling the
--      user_id-based realtime filter to work for DELETE.
--   2. UPDATE events include both old and new column values.

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
