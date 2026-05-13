-- Phase 4b: Expenses & Expense Splits
--
-- Creates:
--   public.expenses        – shared cost tracking per trip
--   public.expense_splits  – per-member split amounts with settlement tracking
--   public.archive_expense – SECURITY DEFINER: organizer or creator only
--   public.settle_expense_split – SECURITY DEFINER: payer or split owner can mark settled

----------------------------------------------------------------------
-- 1. EXPENSES TABLE
----------------------------------------------------------------------

CREATE TABLE public.expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  related_type    TEXT NOT NULL DEFAULT 'manual' CHECK (related_type IN ('accommodation', 'activity', 'transport', 'shopping', 'manual')),
  related_id      UUID,
  title           TEXT NOT NULL CHECK (char_length(title) <= 100),
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'CHF')),
  paid_by         UUID NOT NULL REFERENCES public.users(id),
  created_by      UUID NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at     TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: trip members can view non-archived expenses
CREATE POLICY "expenses_select_member"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    archived_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: any trip member can create expenses
CREATE POLICY "expenses_insert_member"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: organizer can update any, creator can update own (non-archived)
CREATE POLICY "expenses_update_member"
  ON public.expenses FOR UPDATE TO authenticated
  USING (
    archived_at IS NULL
    AND (
      private.is_trip_organizer(trip_id, auth.uid())
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    archived_at IS NULL
    AND (
      private.is_trip_organizer(trip_id, auth.uid())
      OR created_by = auth.uid()
    )
  );

----------------------------------------------------------------------
-- 2. RESTRICT UPDATE FIELDS
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restrict_expense_update_fields()
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
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_expense_update_restrict
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.restrict_expense_update_fields();

----------------------------------------------------------------------
-- 3. EXPENSE_SPLITS TABLE
----------------------------------------------------------------------

CREATE TABLE public.expense_splits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id      UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id),
  amount_owed     NUMERIC(10,2) NOT NULL CHECK (amount_owed >= 0),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  UNIQUE (expense_id, user_id)
);

ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

-- SELECT: trip members can view splits for expenses in their trips
CREATE POLICY "expense_splits_select_member"
  ON public.expense_splits FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id
        AND e.archived_at IS NULL
        AND private.is_trip_member(e.trip_id, auth.uid())
    )
  );

-- INSERT: expense creator can add splits
CREATE POLICY "expense_splits_insert_creator"
  ON public.expense_splits FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id
        AND e.archived_at IS NULL
        AND (e.created_by = auth.uid() OR private.is_trip_organizer(e.trip_id, auth.uid()))
    )
  );

-- UPDATE: handled via settle_expense_split RPC
-- DELETE: cascade from expense deletion handles this

----------------------------------------------------------------------
-- 4. ARCHIVE EXPENSE (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_expense(p_expense_id UUID)
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
    FROM public.expenses
   WHERE id = p_expense_id AND archived_at IS NULL;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  SELECT role INTO v_role
    FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  IF v_role = 'organizer' THEN
    NULL;
  ELSIF v_created_by = v_caller THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.expenses
     SET archived_at = NOW()
   WHERE id = p_expense_id;
END;
$$;

----------------------------------------------------------------------
-- 5. SETTLE EXPENSE SPLIT (SECURITY DEFINER)
----------------------------------------------------------------------
-- The payer or the person who owes can mark a split as settled.

CREATE OR REPLACE FUNCTION public.settle_expense_split(p_split_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_expense_id UUID;
  v_split_user UUID;
  v_paid_by    UUID;
  v_trip_id    UUID;
  v_caller     UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT es.expense_id, es.user_id, e.paid_by, e.trip_id
    INTO v_expense_id, v_split_user, v_paid_by, v_trip_id
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
   WHERE es.id = p_split_id AND e.archived_at IS NULL;

  IF v_expense_id IS NULL THEN
    RAISE EXCEPTION 'Split not found';
  END IF;

  IF v_caller != v_paid_by
     AND v_caller != v_split_user
     AND NOT private.is_trip_organizer(v_trip_id, v_caller)
  THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.expense_splits
     SET status = 'settled'
   WHERE id = p_split_id;
END;
$$;

----------------------------------------------------------------------
-- 6. UNSETTTLE EXPENSE SPLIT (SECURITY DEFINER)
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.unsettle_expense_split(p_split_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_expense_id UUID;
  v_split_user UUID;
  v_paid_by    UUID;
  v_trip_id    UUID;
  v_caller     UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT es.expense_id, es.user_id, e.paid_by, e.trip_id
    INTO v_expense_id, v_split_user, v_paid_by, v_trip_id
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
   WHERE es.id = p_split_id AND e.archived_at IS NULL;

  IF v_expense_id IS NULL THEN
    RAISE EXCEPTION 'Split not found';
  END IF;

  IF v_caller != v_paid_by
     AND v_caller != v_split_user
     AND NOT private.is_trip_organizer(v_trip_id, v_caller)
  THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.expense_splits
     SET status = 'open'
   WHERE id = p_split_id;
END;
$$;

----------------------------------------------------------------------
-- 7. INDEXES
----------------------------------------------------------------------

CREATE INDEX idx_expenses_trip_id ON public.expenses(trip_id) WHERE archived_at IS NULL;
CREATE INDEX idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX idx_expense_splits_expense_id ON public.expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON public.expense_splits(user_id);
CREATE INDEX idx_expense_splits_status ON public.expense_splits(status) WHERE status = 'open';
