-- Allow authenticated users to permanently delete their own account.
--
-- Strategy: anonymize all user-created content by reassigning FK references
-- to a well-known sentinel UUID ("Deleted User") so other group members'
-- trips remain intact. The caller's auth.users row is then deleted, which
-- cascades to public.users and all CASCADE-linked tables.
--
-- Sentinel UUID: 00000000-0000-0000-0000-000000000000

----------------------------------------------------------------------
-- 1. Sentinel user
--    A permanent "Deleted User" row that acts as the FK target for
--    all anonymized content. Must exist in auth.users first (public.users
--    references it). The handle_new_user trigger auto-creates the
--    public.users row; the explicit insert below is a safe fallback.
----------------------------------------------------------------------

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at,
  is_anonymous
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  NULL,
  '',
  '{"full_name": "Deleted User"}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, name, is_guest)
VALUES ('00000000-0000-0000-0000-000000000000', 'Deleted User', false)
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------------------------
-- 2. delete_own_account() RPC
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_sentinel UUID := '00000000-0000-0000-0000-000000000000';
  v_trip_id  UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Safety: never allow deleting the sentinel itself.
  IF v_caller = v_sentinel THEN
    RAISE EXCEPTION 'Cannot delete the sentinel user';
  END IF;

  -- Disable user-defined triggers for this transaction only.
  -- This bypasses: check_last_organizer, all restrict_*_update_fields
  -- guards, and notification triggers. FK constraint triggers (system-
  -- level RI_ConstraintTrigger_*) are NOT affected and remain active.
  SET LOCAL session_replication_role = 'replica';

  ----------------------------------------------------------------
  -- 3. Handle last-organizer trips
  --    For each trip where the caller is the ONLY organizer:
  --    - If other members exist → promote the earliest joiner.
  --    - If the caller is the sole member → soft-delete the trip.
  ----------------------------------------------------------------
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
      -- Promote the earliest-joined other member.
      UPDATE public.trip_members
      SET    role = 'organizer'
      WHERE  id = (
        SELECT id FROM public.trip_members
        WHERE  trip_id = v_trip_id
        AND    user_id != v_caller
        ORDER BY created_at ASC
        LIMIT 1
      );
    ELSE
      -- Caller is the sole member — soft-delete the trip.
      UPDATE public.trips
      SET    deleted_at = now()
      WHERE  id = v_trip_id
      AND    deleted_at IS NULL;
    END IF;
  END LOOP;

  ----------------------------------------------------------------
  -- 4. Reassign non-cascading FK references to the sentinel
  ----------------------------------------------------------------

  -- created_by columns (non-nullable, no CASCADE)
  UPDATE public.trips                SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.activities           SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.accommodations       SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.shopping_lists       SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.shopping_items       SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.recipes              SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.transfer_flights     SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.transfer_vehicles    SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.transfer_rentals     SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.trip_notes           SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.activity_notes       SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.accommodation_notes  SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.prework_topics       SET created_by   = v_sentinel WHERE created_by   = v_caller;
  UPDATE public.invite_tokens        SET created_by   = v_sentinel WHERE created_by   = v_caller;

  -- expenses: created_by + paid_by in one pass
  UPDATE public.expenses
  SET    created_by = CASE WHEN created_by = v_caller THEN v_sentinel ELSE created_by END,
         paid_by    = CASE WHEN paid_by    = v_caller THEN v_sentinel ELSE paid_by    END,
         updated_by = CASE WHEN updated_by = v_caller THEN NULL       ELSE updated_by END
  WHERE  created_by = v_caller OR paid_by = v_caller OR updated_by = v_caller;

  -- settlement_receipts
  UPDATE public.settlement_receipts  SET settled_by   = v_sentinel WHERE settled_by   = v_caller;

  -- expense_splits: drop rows that would conflict with an existing sentinel split
  -- (UNIQUE(expense_id, user_id) would otherwise raise on reassignment when a prior
  -- deletion already placed the sentinel on the same expense).
  DELETE FROM public.expense_splits
  WHERE  user_id     = v_caller
  AND    expense_id IN (
    SELECT expense_id FROM public.expense_splits WHERE user_id = v_sentinel
  );

  -- expense_splits: reassign + null out covered_by in one pass
  UPDATE public.expense_splits
  SET    user_id    = CASE WHEN user_id    = v_caller THEN v_sentinel ELSE user_id    END,
         covered_by = CASE WHEN covered_by = v_caller THEN NULL       ELSE covered_by END
  WHERE  user_id = v_caller OR covered_by = v_caller;

  -- shared_packing_items: reassign created_by + null out claimed_by in one pass
  UPDATE public.shared_packing_items
  SET    created_by = CASE WHEN created_by = v_caller THEN v_sentinel ELSE created_by END,
         claimed_by = CASE WHEN claimed_by = v_caller THEN NULL       ELSE claimed_by END
  WHERE  created_by = v_caller OR claimed_by = v_caller;

  -- lost_found_cases: reassign created_by + null out target_user in one pass
  UPDATE public.lost_found_cases
  SET    created_by  = CASE WHEN created_by  = v_caller THEN v_sentinel ELSE created_by  END,
         target_user = CASE WHEN target_user = v_caller THEN NULL       ELSE target_user END
  WHERE  created_by = v_caller OR target_user = v_caller;

  ----------------------------------------------------------------
  -- 5. Delete avatar from storage
  ----------------------------------------------------------------
  DELETE FROM storage.objects
  WHERE  bucket_id = 'avatars'
  AND    name LIKE v_caller::text || '/%';

  ----------------------------------------------------------------
  -- 6. Delete the auth user — cascades to public.users, which
  --    cascades to all remaining CASCADE-linked tables.
  ----------------------------------------------------------------
  DELETE FROM auth.users WHERE id = v_caller;

END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
