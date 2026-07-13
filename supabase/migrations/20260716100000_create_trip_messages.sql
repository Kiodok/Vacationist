-- Phase: Trip Chat
--
-- Creates:
--   public.trip_messages – one lightweight chat per trip (soft delete)
--   trigger: set_updated_at on BEFORE UPDATE
--   trigger: restrict immutable fields (trip_id, created_by, created_at)
--   public.soft_delete_trip_message – SECURITY DEFINER: sender or organizer
--   RLS: all members read; members create own; sender edits own; delete via RPC only
--   Supabase Realtime enabled on trip_messages

----------------------------------------------------------------------
-- 1. TABLE
----------------------------------------------------------------------

CREATE TABLE public.trip_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES public.users(id),
  text        TEXT NOT NULL CHECK (char_length(text) <= 2000 AND char_length(btrim(text)) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

ALTER TABLE public.trip_messages ENABLE ROW LEVEL SECURITY;

-- Supports keyset pagination:
-- trip_id = ? AND deleted_at IS NULL AND created_at < ? ORDER BY created_at DESC
CREATE INDEX idx_trip_messages_trip_created
  ON public.trip_messages (trip_id, created_at DESC)
  WHERE deleted_at IS NULL;

----------------------------------------------------------------------
-- 2. UPDATED_AT TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE TRIGGER trip_messages_updated_at
  BEFORE UPDATE ON public.trip_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

----------------------------------------------------------------------
-- 3. RLS POLICIES
----------------------------------------------------------------------

-- SELECT: any trip member can read messages.
-- No deleted_at filter here: the soft-delete UPDATE event must pass
-- realtime RLS so other clients can remove the message; queries filter
-- deleted_at client-side.
CREATE POLICY "trip_messages_select_member"
  ON public.trip_messages FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

-- INSERT: any trip member (incl. guests) can send, must own the row
CREATE POLICY "trip_messages_insert_member"
  ON public.trip_messages FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: sender only, and only while not deleted.
-- Organizers may delete any message (via RPC) but never edit others'.
CREATE POLICY "trip_messages_update_owner"
  ON public.trip_messages FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (created_by = auth.uid());

-- No DELETE policy: clients never hard-delete; deletion goes through
-- soft_delete_trip_message (sender or organizer).

----------------------------------------------------------------------
-- 4. IMMUTABLE FIELDS TRIGGER
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_trip_message_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change created_at';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_trip_message_update_restrict
  BEFORE UPDATE ON public.trip_messages
  FOR EACH ROW EXECUTE FUNCTION public.restrict_trip_message_update_fields();

----------------------------------------------------------------------
-- 5. SOFT DELETE RPC (sender: own; organizer: any)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_trip_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id    UUID;
  v_created_by UUID;
  v_caller     UUID := auth.uid();
  v_role       TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT tm.trip_id, tm.created_by
    INTO v_trip_id, v_created_by
    FROM public.trip_messages tm
   WHERE tm.id = p_message_id AND tm.deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  SELECT m.role INTO v_role
    FROM public.trip_members m
   WHERE m.trip_id = v_trip_id AND m.user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  -- Every member (incl. guests) may delete their own message;
  -- organizers may delete any message.
  IF v_created_by <> v_caller AND v_role <> 'organizer' THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.trip_messages
     SET deleted_at = NOW()
   WHERE id = p_message_id;
END;
$$;

----------------------------------------------------------------------
-- 6. ENABLE SUPABASE REALTIME
----------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_messages;
