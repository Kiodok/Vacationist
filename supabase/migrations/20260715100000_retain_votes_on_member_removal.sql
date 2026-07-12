-- Retain votes on member removal + membership-filtered vote visibility.
--
-- Incident: a member's trip_members row was deleted (duplicate-identity cleanup),
-- and trg_cleanup_votes_on_member_removal hard-deleted all their votes. Rejoining
-- with the same user id could not restore them.
--
-- New model:
--   1. Votes are NEVER deleted on member removal. They are hidden at read time
--      (RLS: the voter must be a current trip member) and every auto-close vote
--      count is filtered to current members. Rejoining with the same user id
--      makes the old votes visible and countable again.
--   2. cleanup_votes_on_member_removal (name now historical) still removes
--      vehicle passenger seats + prework preferences, still sends the
--      member_left notification, and now re-evaluates auto-close for the trip's
--      open votings (removing a non-voter can complete a vote).
--   3. Folded-in fixes discovered during this work:
--      a. restrict_transfer_flight_update_fields lacked the pg_trigger_depth()
--         bypass that activities/accommodations have — a non-organizer's final
--         vote on an auto_close flight raised 'Only organizers can change
--         voting_open'.
--      b. Migration 20260619110000 added the group_blocker guard to a function
--         named auto_finalize_flight_voting(), but the live trigger
--         on_transfer_flight_vote_inserted still executes
--         auto_finalize_transfer_flight_voting() — the guard never took effect.
--         Both functions get the corrected body and the trigger wiring is
--         re-asserted deterministically.

----------------------------------------------------------------------
-- 1. restrict_transfer_flight_update_fields — add trigger-depth bypass
--    (same pattern as restrict_accommodation_update_fields, 20260513200002)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restrict_transfer_flight_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Allow system-level updates (auto-finalize / member-removal re-evaluation
  -- running at pg_trigger_depth() >= 2) to bypass organizer checks — auth.uid()
  -- is not meaningful inside a trigger stack.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;

  IF NOT private.is_trip_organizer(OLD.trip_id, auth.uid()) THEN
    IF NEW.voting_open IS DISTINCT FROM OLD.voting_open THEN
      RAISE EXCEPTION 'Only organizers can change voting_open';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only organizers can change status';
    END IF;
    IF NEW.flight_number IS DISTINCT FROM OLD.flight_number THEN
      RAISE EXCEPTION 'Only organizers can set flight_number';
    END IF;
    IF NEW.booking_reference IS DISTINCT FROM OLD.booking_reference THEN
      RAISE EXCEPTION 'Only organizers can set booking_reference';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 2. cleanup_votes_on_member_removal — stop deleting votes; re-evaluate
--    auto-close; keep passenger/prework cleanup + member_left notification
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_votes_on_member_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_member_count INT;
  v_trip_title   TEXT;
  v_member_name  TEXT;
  v_reason       TEXT;
BEGIN
  -- Votes are intentionally NOT deleted (since 20260715100000). They are hidden
  -- by RLS while the voter is not a member and restored on rejoin.

  -- Remove passenger rows from all vehicles in this trip
  DELETE FROM public.transfer_vehicle_passengers
  WHERE user_id = OLD.user_id
    AND vehicle_id IN (
      SELECT id FROM public.transfer_vehicles
      WHERE trip_id = OLD.trip_id AND deleted_at IS NULL
    );

  -- Remove prework preferences for this trip
  DELETE FROM public.prework_preferences
  WHERE user_id = OLD.user_id
    AND trip_id = OLD.trip_id;

  -- Re-evaluate auto-close: with one member fewer, the remaining current-member
  -- votes may now satisfy the threshold. Counts consider current members only.
  SELECT COUNT(*) INTO v_member_count
  FROM public.trip_members
  WHERE trip_id = OLD.trip_id;

  IF v_member_count > 0 THEN
    UPDATE public.activities a
       SET voting_open = FALSE
     WHERE a.trip_id = OLD.trip_id
       AND a.deleted_at IS NULL
       AND a.voting_open = TRUE
       AND a.auto_close = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM public.activity_votes v
           JOIN public.trip_members tm
             ON tm.trip_id = a.trip_id AND tm.user_id = v.user_id
          WHERE v.activity_id = a.id AND v.vote = 'group_blocker'
       )
       AND (
         SELECT COUNT(*) FROM public.activity_votes v
           JOIN public.trip_members tm
             ON tm.trip_id = a.trip_id AND tm.user_id = v.user_id
          WHERE v.activity_id = a.id
       ) >= v_member_count;

    UPDATE public.accommodations a
       SET voting_open = FALSE
     WHERE a.trip_id = OLD.trip_id
       AND a.deleted_at IS NULL
       AND a.voting_open = TRUE
       AND a.auto_close = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM public.accommodation_votes v
           JOIN public.trip_members tm
             ON tm.trip_id = a.trip_id AND tm.user_id = v.user_id
          WHERE v.accommodation_id = a.id AND v.vote = 'group_blocker'
       )
       AND (
         SELECT COUNT(*) FROM public.accommodation_votes v
           JOIN public.trip_members tm
             ON tm.trip_id = a.trip_id AND tm.user_id = v.user_id
          WHERE v.accommodation_id = a.id
       ) >= v_member_count;

    UPDATE public.transfer_flights f
       SET voting_open = FALSE
     WHERE f.trip_id = OLD.trip_id
       AND f.deleted_at IS NULL
       AND f.voting_open = TRUE
       AND f.auto_close = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM public.transfer_flight_votes v
           JOIN public.trip_members tm
             ON tm.trip_id = f.trip_id AND tm.user_id = v.user_id
          WHERE v.flight_id = f.id AND v.vote = 'group_blocker'
       )
       AND (
         SELECT COUNT(*) FROM public.transfer_flight_votes v
           JOIN public.trip_members tm
             ON tm.trip_id = f.trip_id AND tm.user_id = v.user_id
          WHERE v.flight_id = f.id
       ) >= v_member_count;
  END IF;

  -- Notify remaining members that someone left or was removed.
  SELECT title INTO v_trip_title
  FROM public.trips
  WHERE id = OLD.trip_id AND deleted_at IS NULL;

  IF v_trip_title IS NULL THEN
    -- Trip was soft-deleted (trip_deleted notification already sent) — skip.
    RETURN OLD;
  END IF;

  SELECT name INTO v_member_name
  FROM public.users
  WHERE id = OLD.user_id;

  -- Determine if this is a voluntary leave or an organizer kick.
  v_reason := CASE WHEN auth.uid() = OLD.user_id THEN 'left' ELSE 'removed' END;

  PERFORM private.create_trip_notification(
    OLD.trip_id,        -- p_trip_id
    OLD.user_id,        -- p_exclude_user_id (don't notify the person who left)
    'member_left',      -- p_type
    'Member left',      -- p_title (overridden by client i18n)
    NULL,               -- p_body
    NULL,               -- p_related_type
    NULL,               -- p_related_id
    v_reason,           -- p_context_entity ('left' or 'removed')
    v_trip_title,       -- p_context_trip
    v_member_name       -- p_context_creator
  );

  RETURN OLD;
END;
$$;

----------------------------------------------------------------------
-- 3. RLS SELECT policies — votes are visible only while the VOTER is a
--    current trip member (caller-membership check unchanged)
----------------------------------------------------------------------
DROP POLICY IF EXISTS "activity_votes_select_member" ON public.activity_votes;
CREATE POLICY "activity_votes_select_member"
  ON public.activity_votes FOR SELECT TO authenticated
  USING (
    private.is_trip_member(trip_id, auth.uid())
    AND private.is_trip_member(trip_id, user_id)
  );

DROP POLICY IF EXISTS "accommodation_votes_select_member" ON public.accommodation_votes;
CREATE POLICY "accommodation_votes_select_member"
  ON public.accommodation_votes FOR SELECT TO authenticated
  USING (
    private.is_trip_member(trip_id, auth.uid())
    AND private.is_trip_member(trip_id, user_id)
  );

-- transfer_flight_votes.trip_id is nullable (denormalized later, 20260523000001)
-- so keep the original parent-EXISTS shape and take trip_id from the flight.
DROP POLICY IF EXISTS "transfer_flight_votes_select_member" ON public.transfer_flight_votes;
CREATE POLICY "transfer_flight_votes_select_member"
  ON public.transfer_flight_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_flights f
      WHERE f.id = flight_id
        AND f.deleted_at IS NULL
        AND private.is_trip_member(f.trip_id, auth.uid())
        AND private.is_trip_member(f.trip_id, user_id)
    )
  );

----------------------------------------------------------------------
-- 4. Auto-finalize on vote INSERT/UPDATE — count current members' votes only
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_finalize_activity_voting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id      UUID;
  v_voting_open  BOOLEAN;
  v_auto_close   BOOLEAN;
  v_member_count INT;
  v_vote_count   INT;
  v_blocker_count INT;
BEGIN
  SELECT a.trip_id, a.voting_open, a.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.activities a
   WHERE a.id = NEW.activity_id;

  IF NOT v_voting_open THEN
    RETURN NEW;
  END IF;

  IF NOT v_auto_close THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.activity_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.activity_id = NEW.activity_id
     AND v.vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.activity_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.activity_id = NEW.activity_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.activities
       SET voting_open = FALSE
     WHERE id = NEW.activity_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_finalize_accommodation_voting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id      UUID;
  v_voting_open  BOOLEAN;
  v_auto_close   BOOLEAN;
  v_member_count INT;
  v_vote_count   INT;
  v_blocker_count INT;
BEGIN
  SELECT a.trip_id, a.voting_open, a.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.accommodations a
   WHERE a.id = NEW.accommodation_id;

  IF NOT v_voting_open THEN
    RETURN NEW;
  END IF;

  IF NOT v_auto_close THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.accommodation_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.accommodation_id = NEW.accommodation_id
     AND v.vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.accommodation_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.accommodation_id = NEW.accommodation_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.accommodations
       SET voting_open = FALSE
     WHERE id = NEW.accommodation_id;
  END IF;

  RETURN NEW;
END;
$$;

-- The LIVE flight function (wired to on_transfer_flight_vote_inserted).
-- Gains the group_blocker guard that 20260619110000 intended plus the
-- member-filtered counts.
CREATE OR REPLACE FUNCTION public.auto_finalize_transfer_flight_voting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id      UUID;
  v_voting_open  BOOLEAN;
  v_auto_close   BOOLEAN;
  v_member_count INT;
  v_vote_count   INT;
  v_blocker_count INT;
BEGIN
  SELECT f.trip_id, f.voting_open, f.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.transfer_flights f
   WHERE f.id = NEW.flight_id;

  IF NOT v_voting_open THEN
    RETURN NEW;
  END IF;

  IF NOT v_auto_close THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.transfer_flight_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.flight_id = NEW.flight_id
     AND v.vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.transfer_flight_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.flight_id = NEW.flight_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.transfer_flights
       SET voting_open = FALSE
     WHERE id = NEW.flight_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Orphaned twin from 20260619110000 (no trigger points at it). Kept correct so
-- the system behaves identically regardless of environment wiring.
CREATE OR REPLACE FUNCTION public.auto_finalize_flight_voting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id      UUID;
  v_voting_open  BOOLEAN;
  v_auto_close   BOOLEAN;
  v_member_count INT;
  v_vote_count   INT;
  v_blocker_count INT;
BEGIN
  SELECT f.trip_id, f.voting_open, f.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.transfer_flights f
   WHERE f.id = NEW.flight_id;

  IF NOT v_voting_open THEN
    RETURN NEW;
  END IF;

  IF NOT v_auto_close THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.transfer_flight_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.flight_id = NEW.flight_id
     AND v.vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.transfer_flight_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.flight_id = NEW.flight_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.transfer_flights
       SET voting_open = FALSE
     WHERE id = NEW.flight_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Deterministic wiring: the INSERT/UPDATE trigger executes the LIVE function.
CREATE OR REPLACE TRIGGER on_transfer_flight_vote_inserted
  AFTER INSERT OR UPDATE ON public.transfer_flight_votes
  FOR EACH ROW EXECUTE FUNCTION public.auto_finalize_transfer_flight_voting();

----------------------------------------------------------------------
-- 5. Auto-finalize on blocker removal — count current members' votes only
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_finalize_activity_voting_on_blocker_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id       UUID;
  v_voting_open   BOOLEAN;
  v_auto_close    BOOLEAN;
  v_blocker_count INT;
  v_member_count  INT;
  v_vote_count    INT;
BEGIN
  IF OLD.vote <> 'group_blocker' THEN
    RETURN OLD;
  END IF;

  SELECT a.trip_id, a.voting_open, a.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.activities a
   WHERE a.id = OLD.activity_id;

  IF NOT v_voting_open THEN
    RETURN OLD;
  END IF;

  IF NOT v_auto_close THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.activity_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.activity_id = OLD.activity_id
     AND v.vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.activity_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.activity_id = OLD.activity_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.activities SET voting_open = FALSE WHERE id = OLD.activity_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_finalize_accommodation_voting_on_blocker_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id       UUID;
  v_voting_open   BOOLEAN;
  v_auto_close    BOOLEAN;
  v_blocker_count INT;
  v_member_count  INT;
  v_vote_count    INT;
BEGIN
  IF OLD.vote <> 'group_blocker' THEN
    RETURN OLD;
  END IF;

  SELECT a.trip_id, a.voting_open, a.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.accommodations a
   WHERE a.id = OLD.accommodation_id;

  IF NOT v_voting_open THEN
    RETURN OLD;
  END IF;

  IF NOT v_auto_close THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.accommodation_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.accommodation_id = OLD.accommodation_id
     AND v.vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.accommodation_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.accommodation_id = OLD.accommodation_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.accommodations SET voting_open = FALSE WHERE id = OLD.accommodation_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_finalize_flight_voting_on_blocker_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id       UUID;
  v_voting_open   BOOLEAN;
  v_auto_close    BOOLEAN;
  v_blocker_count INT;
  v_member_count  INT;
  v_vote_count    INT;
BEGIN
  IF OLD.vote <> 'group_blocker' THEN
    RETURN OLD;
  END IF;

  SELECT f.trip_id, f.voting_open, f.auto_close
    INTO v_trip_id, v_voting_open, v_auto_close
    FROM public.transfer_flights f
   WHERE f.id = OLD.flight_id;

  IF NOT v_voting_open THEN
    RETURN OLD;
  END IF;

  IF NOT v_auto_close THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_blocker_count
    FROM public.transfer_flight_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.flight_id = OLD.flight_id
     AND v.vote = 'group_blocker';

  IF v_blocker_count > 0 THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = v_trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.transfer_flight_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = v.user_id
   WHERE v.flight_id = OLD.flight_id;

  IF v_vote_count >= v_member_count THEN
    UPDATE public.transfer_flights SET voting_open = FALSE WHERE id = OLD.flight_id;
  END IF;

  RETURN OLD;
END;
$$;

----------------------------------------------------------------------
-- 6. Retroactive auto-close — count current members' votes only
--    (unchanged otherwise; has never had a blocker guard)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retroactive_auto_close_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_member_count INT;
  v_vote_count   INT;
BEGIN
  -- Only act when auto_close is being switched from FALSE to TRUE while voting
  -- is still open.
  IF NOT (OLD.auto_close = FALSE AND NEW.auto_close = TRUE AND NEW.voting_open = TRUE) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_member_count
    FROM public.trip_members
   WHERE trip_id = NEW.trip_id;

  SELECT COUNT(*) INTO v_vote_count
    FROM public.activity_votes v
    JOIN public.trip_members tm
      ON tm.trip_id = NEW.trip_id AND tm.user_id = v.user_id
   WHERE v.activity_id = NEW.id;

  IF v_vote_count >= v_member_count THEN
    NEW.voting_open := FALSE;
  END IF;

  RETURN NEW;
END;
$$;
