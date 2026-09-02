-- v1.33.0 task 17: Public Transport — 4th Transfer segment.
--
-- Same shape as transfer_rentals (20260522000004_create_transfer_rentals.sql), swapping
-- rental-specific fields for transit ones (departure/arrival location + time instead of
-- pickup/dropoff location + date). No voting, no passengers — same as rentals.
--
-- The SELECT policy is written directly in its final, correct form (no `deleted_at IS NULL`
-- clause) per the fix in 20260522000008_transfer_realtime_softdelete_rls.sql: that clause on a
-- table using soft-delete breaks realtime propagation of the delete event (the post-UPDATE row
-- fails its own SELECT policy, so Supabase Realtime drops the event for every other subscriber).
-- Filtering on `deleted_at IS NULL` belongs in the API layer's explicit query instead.

----------------------------------------------------------------------
-- 1. TRANSFER_PUBLIC_TRANSPORT TABLE
----------------------------------------------------------------------

CREATE TABLE public.transfer_public_transport (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title               TEXT NOT NULL CHECK (char_length(title) <= 100),
  company             TEXT CHECK (char_length(company) <= 100),
  departure_location  TEXT CHECK (char_length(departure_location) <= 200),
  arrival_location    TEXT CHECK (char_length(arrival_location) <= 200),
  departure_time      TIMESTAMPTZ,
  arrival_time        TIMESTAMPTZ,
  booking_reference   TEXT CHECK (char_length(booking_reference) <= 50),
  price_total         NUMERIC(10,2),
  external_url        TEXT CHECK (char_length(external_url) <= 2048),
  notes               TEXT CHECK (char_length(notes) <= 500),
  created_by          UUID NOT NULL REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.transfer_public_transport ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER transfer_public_transport_updated_at
  BEFORE UPDATE ON public.transfer_public_transport
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transfer_public_transport
  ADD CONSTRAINT transfer_public_transport_external_url_https
  CHECK (external_url IS NULL OR external_url LIKE 'https://%');

-- SELECT: trip members (deleted_at filtering happens in the API layer — see header note)
CREATE POLICY "transfer_public_transport_select_member"
  ON public.transfer_public_transport FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()));

-- INSERT: any trip member can create a public transport entry
CREATE POLICY "transfer_public_transport_insert_member"
  ON public.transfer_public_transport FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: organizer or creator
CREATE POLICY "transfer_public_transport_update_member"
  ON public.transfer_public_transport FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      private.is_trip_organizer(trip_id, auth.uid())
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND (
      private.is_trip_organizer(trip_id, auth.uid())
      OR created_by = auth.uid()
    )
  );

----------------------------------------------------------------------
-- 2. SOFT DELETE TRANSFER PUBLIC TRANSPORT (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_transfer_public_transport(p_id UUID)
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

  SELECT trip_id, created_by
    INTO v_trip_id, v_created_by
    FROM public.transfer_public_transport
   WHERE id = p_id AND deleted_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Public transport entry not found';
  END IF;

  SELECT role INTO v_role
    FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  IF v_role = 'organizer' THEN
    NULL;
  ELSIF v_role = 'participant' AND v_created_by = v_caller THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.transfer_public_transport
     SET deleted_at = NOW()
   WHERE id = p_id;
END;
$$;

----------------------------------------------------------------------
-- 3. REALTIME + INDEXES
----------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_public_transport;

CREATE INDEX idx_transfer_public_transport_trip_id ON public.transfer_public_transport(trip_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transfer_public_transport_created_by ON public.transfer_public_transport(created_by);

----------------------------------------------------------------------
-- 4. get_trip_tab_content — include public transport in the `transfer` flag
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_trip_tab_content(p_trip_id UUID)
RETURNS TABLE(
  chat       BOOLEAN,
  prework    BOOLEAN,
  base       BOOLEAN,
  transfer   BOOLEAN,
  expenses   BOOLEAN,
  activities BOOLEAN,
  stuff      BOOLEAN,
  shopping   BOOLEAN,
  notes      BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1 FROM public.trip_messages
      WHERE trip_id = p_trip_id AND deleted_at IS NULL
    ) AS chat,
    EXISTS (
      SELECT 1 FROM public.prework_topics
      WHERE trip_id = p_trip_id
    ) AS prework,
    EXISTS (
      SELECT 1 FROM public.accommodations
      WHERE trip_id = p_trip_id AND deleted_at IS NULL
    ) AS base,
    (
      EXISTS (SELECT 1 FROM public.transfer_flights WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.transfer_vehicles WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.transfer_rentals WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.transfer_public_transport WHERE trip_id = p_trip_id AND deleted_at IS NULL)
    ) AS transfer,
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE trip_id = p_trip_id AND archived_at IS NULL
    ) AS expenses,
    EXISTS (
      SELECT 1 FROM public.activities
      WHERE trip_id = p_trip_id AND deleted_at IS NULL
    ) AS activities,
    (
      EXISTS (SELECT 1 FROM public.packing_items WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.shared_packing_items WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.lost_found_cases WHERE trip_id = p_trip_id)
    ) AS stuff,
    (
      EXISTS (SELECT 1 FROM public.shopping_lists WHERE trip_id = p_trip_id AND archived_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.shopping_items WHERE trip_id = p_trip_id AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.recipes WHERE trip_id = p_trip_id)
    ) AS shopping,
    EXISTS (
      SELECT 1 FROM public.trip_notes
      WHERE trip_id = p_trip_id
    ) AS notes;
END;
$$;

----------------------------------------------------------------------
-- 5. delete_own_account — reassign created_by (per CLAUDE.md Account Deletion rule)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_sentinel UUID := '00000000-0000-0000-0000-000000000000';
  v_trip_id  UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller = v_sentinel THEN
    RAISE EXCEPTION 'Cannot delete the sentinel user';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_caller AND is_guest) THEN
    RAISE EXCEPTION 'Guest accounts cannot be deleted via this RPC';
  END IF;

  SET LOCAL session_replication_role = 'replica';

  FOR v_trip_id IN
    SELECT tm.trip_id
    FROM   public.trip_members tm
    WHERE  tm.user_id = v_caller
    AND    tm.role = 'organizer'
    AND    NOT EXISTS (
      SELECT 1 FROM public.trip_members tm2
      WHERE  tm2.trip_id  = tm.trip_id
      AND    tm2.role     = 'organizer'
      AND    tm2.user_id != v_caller
    )
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = v_trip_id AND user_id != v_caller
    ) THEN
      UPDATE public.trip_members
      SET    role = 'organizer'
      WHERE  id = (
        SELECT id FROM public.trip_members
        WHERE  trip_id = v_trip_id
        AND    user_id != v_caller
        ORDER BY (role = 'guest'), joined_at ASC
        LIMIT 1
      );
    ELSE
      UPDATE public.trips
      SET    deleted_at = now()
      WHERE  id = v_trip_id
      AND    deleted_at IS NULL;
    END IF;
  END LOOP;

  UPDATE public.trips                    SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.activities               SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.accommodations           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.shopping_lists           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.shopping_items           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.recipes                  SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_flights         SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_vehicles        SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_rentals         SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.transfer_public_transport SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.trip_notes               SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.activity_notes           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.accommodation_notes      SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.prework_topics           SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.invite_tokens            SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.trip_messages            SET created_by = v_sentinel WHERE created_by = v_caller;
  UPDATE public.expense_documents        SET uploaded_by = v_sentinel WHERE uploaded_by = v_caller;

  UPDATE public.expenses
  SET    created_by = CASE WHEN created_by = v_caller THEN v_sentinel ELSE created_by END,
         paid_by    = CASE WHEN paid_by    = v_caller THEN v_sentinel ELSE paid_by    END,
         updated_by = CASE WHEN updated_by = v_caller THEN NULL       ELSE updated_by END
  WHERE  created_by = v_caller OR paid_by = v_caller OR updated_by = v_caller;

  UPDATE public.settlement_receipts  SET settled_by = v_sentinel WHERE settled_by = v_caller;

  DELETE FROM public.expense_splits
  WHERE  user_id    = v_caller
  AND    expense_id IN (
    SELECT expense_id FROM public.expense_splits WHERE user_id = v_sentinel
  );

  UPDATE public.expense_splits
  SET    user_id    = CASE WHEN user_id    = v_caller THEN v_sentinel ELSE user_id    END,
         covered_by = CASE WHEN covered_by = v_caller THEN NULL       ELSE covered_by END
  WHERE  user_id = v_caller OR covered_by = v_caller;

  DELETE FROM public.transfer_documents
  WHERE  user_id   = v_caller
  AND    flight_id IN (
    SELECT flight_id FROM public.transfer_documents WHERE user_id = v_sentinel
  );

  UPDATE public.transfer_documents
  SET    user_id     = CASE WHEN user_id     = v_caller THEN v_sentinel ELSE user_id     END,
         uploaded_by = CASE WHEN uploaded_by = v_caller THEN v_sentinel ELSE uploaded_by END
  WHERE  user_id = v_caller OR uploaded_by = v_caller;

  UPDATE public.shared_packing_items
  SET    created_by = CASE WHEN created_by = v_caller THEN v_sentinel ELSE created_by END,
         claimed_by = CASE WHEN claimed_by = v_caller THEN NULL       ELSE claimed_by END
  WHERE  created_by = v_caller OR claimed_by = v_caller;

  UPDATE public.lost_found_cases
  SET    created_by  = CASE WHEN created_by  = v_caller THEN v_sentinel ELSE created_by  END,
         target_user = CASE WHEN target_user = v_caller THEN NULL       ELSE target_user END
  WHERE  created_by = v_caller OR target_user = v_caller;

  DELETE FROM storage.objects
  WHERE  bucket_id = 'avatars'
  AND    name LIKE v_caller::text || '/%';

  DELETE FROM public.trip_members WHERE user_id = v_caller;

  SET LOCAL session_replication_role = 'origin';

  DELETE FROM auth.users WHERE id = v_caller;

END;
$$;
