-- Phase: Stuff Feature
-- Migration 2: Extend notification types and preferences for Stuff feature

----------------------------------------------------------------------
-- 1. ADD NEW NOTIFICATION TYPES
-- Drop and recreate the CHECK constraint to add 'lost_found' and 'shared_packing'.
----------------------------------------------------------------------

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'new_activity',
    'vote_update',
    'expense_change',
    'new_member',
    'schedule_change',
    'reminder',
    'vote_finalized',
    'document_access_request',
    'lost_found',
    'shared_packing'
  ));

----------------------------------------------------------------------
-- 2. ADD PREFERENCE COLUMNS TO notification_preferences
----------------------------------------------------------------------

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS lost_found    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS shared_packing BOOLEAN NOT NULL DEFAULT TRUE;
