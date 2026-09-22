-- v1.39.0 round 3 (22.09 test session): let the "Deleted User" sentinel pass the split-membership
-- check, so an expense that already has a departed member's historical share (see
-- delete_own_account's sentinel reassignment, documented in CLAUDE.md's Account Deletion section
-- and disclosed at docs/delete-account.html) can be edited again.
--
-- Root cause (confirmed against a real dev-DB row): once a trip member deletes their account, any
-- open expense_splits row they held is reassigned to '00000000-0000-0000-0000-000000000000'
-- ("Deleted User") rather than deleted — correct, intentional retention behavior, NOT changed here.
-- But `update_expense_with_splits` is a full-replace update: the client always resubmits every
-- stored split (the sentinel's included, since the app must never silently drop or recompute a
-- departed member's historical share — see EditExpenseSheet.tsx's locked-split UI added alongside
-- this migration), and the existing membership check rejected the sentinel as "not a trip member",
-- so ANY edit to such an expense failed outright, even one that only changed the title.
--
-- Change: both `create_expense_with_splits` and `update_expense_with_splits` now accept the sentinel
-- id specifically, in addition to real trip members. Applied to `create` too for symmetry, though
-- the client never offers the sentinel as a selectable member for a NEW expense — only an edit of an
-- expense created before the relevant member left the trip can ever submit it.
--
-- No signature change on either function — CREATE OR REPLACE only, no DROP FUNCTION needed.

CREATE OR REPLACE FUNCTION public.create_expense_with_splits(
  p_trip_id       UUID,
  p_title         TEXT,
  p_amount        NUMERIC(10,2),
  p_currency      TEXT,
  p_paid_by       UUID,
  p_related_type  TEXT,
  p_related_id    UUID,
  p_split_method  TEXT,
  p_splits        JSONB,
  p_description   TEXT DEFAULT NULL,
  p_is_business   BOOLEAN DEFAULT FALSE,
  p_tip_amount    NUMERIC(10,2) DEFAULT 0,
  p_id            UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller          UUID := auth.uid();
  v_expense_id      UUID;
  v_split_count     INT;
  v_entry           JSONB;
  v_user_id         UUID;
  v_amount          NUMERIC(10,2);
  v_total_shares    INT;
  v_sum_check       NUMERIC(10,2);
  v_i               INT;
  v_even_amt        NUMERIC(10,2);
  v_running         NUMERIC(10,2) := 0;
  v_shares_val      INT;
  v_base_currency   TEXT;
  v_exchange_rate   NUMERIC(18,8);
  v_rate_base       NUMERIC(18,8);
  v_rate_target     NUMERIC(18,8);
  v_converted_amt   NUMERIC(10,2);
  v_owed_base       NUMERIC(10,2);
  v_tip             NUMERIC(10,2) := COALESCE(p_tip_amount, 0);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.is_trip_member(p_trip_id, v_caller) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  -- Idempotent replay of an offline-queued create. The client mints `p_id` (a real UUID) so the
  -- optimistic row, the queue entry and this insert share one key. If an earlier attempt already landed
  -- (request succeeded, response lost) the same id comes straight back instead of raising a duplicate-key
  -- error that would strand the queued change. Only the caller's own row in the same trip qualifies, so a
  -- guessed/foreign id can never be used to probe another trip's expense.
  IF p_id IS NOT NULL THEN
    SELECT id INTO v_expense_id
      FROM public.expenses
     WHERE id = p_id AND trip_id = p_trip_id AND created_by = v_caller;
    IF v_expense_id IS NOT NULL THEN
      RETURN v_expense_id;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id AND user_id = p_paid_by
  ) THEN
    RAISE EXCEPTION 'Payer must be a trip member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.currency_catalog WHERE code = p_currency AND is_active
  ) THEN
    RAISE EXCEPTION 'Unsupported currency: %', p_currency;
  END IF;

  v_split_count := jsonb_array_length(p_splits);
  IF v_split_count IS NULL OR v_split_count < 1 THEN
    RAISE EXCEPTION 'At least one split member required';
  END IF;

  IF v_split_count > 50 THEN
    RAISE EXCEPTION 'Too many splits (maximum 50)';
  END IF;

  IF p_split_method NOT IN ('even', 'exact', 'shares', 'cover') THEN
    RAISE EXCEPTION 'Invalid split method: %', p_split_method;
  END IF;

  IF p_related_type NOT IN (
    'accommodation', 'activity', 'transport', 'shopping', 'manual',
    'food_drink', 'groceries', 'fuel_parking', 'tickets_entry', 'health', 'souvenirs'
  ) THEN
    RAISE EXCEPTION 'Invalid category: %', p_related_type;
  END IF;

  IF v_tip < 0 OR v_tip > p_amount THEN
    RAISE EXCEPTION 'Tip must be between 0 and the expense amount';
  END IF;

  -- Every split member must be a real trip member OR the "Deleted User" sentinel (a departed
  -- member's historical share, resubmitted unchanged — see this migration's header comment).
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) e
    LEFT JOIN public.trip_members tm
      ON tm.trip_id = p_trip_id AND tm.user_id = (e->>'user_id')::UUID
    WHERE tm.user_id IS NULL
      AND (e->>'user_id')::UUID != '00000000-0000-0000-0000-000000000000'::UUID
  ) THEN
    RAISE EXCEPTION 'All split members must be trip members';
  END IF;

  IF p_split_method = 'exact' THEN
    SELECT COALESCE(SUM((e->>'amount')::NUMERIC), 0)
      INTO v_sum_check
      FROM jsonb_array_elements(p_splits) e;
    IF ROUND(v_sum_check, 2) != ROUND(p_amount, 2) THEN
      RAISE EXCEPTION 'Split amounts (%) do not sum to expense amount (%)', v_sum_check, p_amount;
    END IF;
  END IF;

  IF p_split_method = 'shares' THEN
    SELECT COALESCE(SUM((e->>'shares')::INT), 0)
      INTO v_total_shares
      FROM jsonb_array_elements(p_splits) e;
    IF v_total_shares <= 0 THEN
      RAISE EXCEPTION 'Total shares must be greater than zero';
    END IF;
  END IF;

  IF p_split_method = 'cover' THEN
    IF v_split_count != 1 THEN
      RAISE EXCEPTION 'Cover method requires exactly one split entry';
    END IF;
    IF (p_splits->0->>'user_id')::UUID = p_paid_by THEN
      RAISE EXCEPTION 'Cannot cover yourself';
    END IF;
  END IF;

  -- ── FX: resolve exchange_rate / converted_amount, frozen at write time ──────
  SELECT base_currency INTO v_base_currency FROM public.trips WHERE id = p_trip_id;

  IF p_currency = v_base_currency THEN
    v_exchange_rate := 1;
  ELSE
    v_rate_base   := private.get_latest_exchange_rate(v_base_currency);
    v_rate_target := private.get_latest_exchange_rate(p_currency);
    IF v_rate_base IS NULL OR v_rate_target IS NULL THEN
      RAISE EXCEPTION 'Exchange rate unavailable for % -> %', p_currency, v_base_currency;
    END IF;
    v_exchange_rate := v_rate_base / v_rate_target;
  END IF;

  v_converted_amt := ROUND(p_amount * v_exchange_rate, 2);

  INSERT INTO public.expenses (id, trip_id, title, description, amount, currency, paid_by, related_type, related_id, split_method, created_by, exchange_rate, converted_amount, is_business, tip_amount)
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    p_trip_id, p_title,
    CASE WHEN p_description = '' THEN NULL ELSE p_description END,
    p_amount, p_currency, p_paid_by, p_related_type, p_related_id, p_split_method, v_caller, v_exchange_rate, v_converted_amt,
    COALESCE(p_is_business, FALSE),
    v_tip
  )
  RETURNING id INTO v_expense_id;

  IF p_split_method = 'even' THEN
    v_even_amt := ROUND(p_amount / v_split_count, 2);
  END IF;

  FOR v_i IN 0..(v_split_count - 1) LOOP
    v_entry := p_splits->v_i;
    v_user_id := (v_entry->>'user_id')::UUID;

    CASE p_split_method
      WHEN 'even' THEN
        IF v_i = v_split_count - 1 THEN
          v_amount := p_amount - v_running;
        ELSE
          v_amount := v_even_amt;
        END IF;
      WHEN 'exact' THEN
        v_amount := ROUND((v_entry->>'amount')::NUMERIC, 2);
      WHEN 'shares' THEN
        v_shares_val := (v_entry->>'shares')::INT;
        IF v_i = v_split_count - 1 THEN
          v_amount := p_amount - v_running;
        ELSE
          v_amount := ROUND(p_amount * v_shares_val / v_total_shares, 2);
        END IF;
      WHEN 'cover' THEN
        v_amount := p_amount;
    END CASE;

    v_running := v_running + v_amount;
    v_owed_base := ROUND(v_amount * v_exchange_rate, 2);

    INSERT INTO public.expense_splits (expense_id, user_id, amount_owed, status, amount_owed_original_currency)
    VALUES (
      v_expense_id,
      v_user_id,
      v_owed_base,
      CASE WHEN v_user_id = p_paid_by THEN 'settled' ELSE 'open' END,
      CASE WHEN p_currency = v_base_currency THEN NULL ELSE v_amount END
    );
  END LOOP;

  RETURN v_expense_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_expense_with_splits(
  p_expense_id    UUID,
  p_title         TEXT,
  p_amount        NUMERIC(10,2),
  p_paid_by       UUID,
  p_split_method  TEXT,
  p_splits        JSONB,
  p_currency      TEXT DEFAULT NULL,
  p_related_type  TEXT DEFAULT NULL,
  p_description   TEXT DEFAULT NULL,
  p_is_business   BOOLEAN DEFAULT NULL,
  p_tip_amount    NUMERIC(10,2) DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller          UUID := auth.uid();
  v_trip_id         UUID;
  v_created_by      UUID;
  v_role            TEXT;
  v_split_count     INT;
  v_entry           JSONB;
  v_user_id         UUID;
  v_amount          NUMERIC(10,2);
  v_total_shares    INT;
  v_sum_check       NUMERIC(10,2);
  v_i               INT;
  v_even_amt        NUMERIC(10,2);
  v_running         NUMERIC(10,2) := 0;
  v_shares_val      INT;
  v_base_currency   TEXT;
  v_currency        TEXT;
  v_exchange_rate   NUMERIC(18,8);
  v_rate_base       NUMERIC(18,8);
  v_rate_target     NUMERIC(18,8);
  v_converted_amt   NUMERIC(10,2);
  v_owed_base       NUMERIC(10,2);
  v_existing_tip    NUMERIC(10,2);
  v_tip             NUMERIC(10,2);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trip_id, created_by, tip_amount
    INTO v_trip_id, v_created_by, v_existing_tip
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

  IF v_role != 'organizer' AND v_created_by != v_caller THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = v_trip_id AND user_id = p_paid_by
  ) THEN
    RAISE EXCEPTION 'Payer must be a trip member';
  END IF;

  -- p_currency omitted (old app, pre-Phase-15) -> keep the expense's current currency.
  IF p_currency IS NULL THEN
    SELECT currency INTO v_currency FROM public.expenses WHERE id = p_expense_id;
  ELSE
    v_currency := p_currency;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.currency_catalog WHERE code = v_currency AND is_active
  ) THEN
    RAISE EXCEPTION 'Unsupported currency: %', v_currency;
  END IF;

  IF p_related_type IS NOT NULL AND p_related_type NOT IN (
    'accommodation', 'activity', 'transport', 'shopping', 'manual',
    'food_drink', 'groceries', 'fuel_parking', 'tickets_entry', 'health', 'souvenirs'
  ) THEN
    RAISE EXCEPTION 'Invalid category: %', p_related_type;
  END IF;

  -- p_tip_amount omitted (old app) -> keep the stored tip, clamped so a lowered amount can't strand
  -- it above the total. An explicit value is validated as-is.
  IF p_tip_amount IS NULL THEN
    v_tip := LEAST(v_existing_tip, p_amount);
  ELSE
    v_tip := p_tip_amount;
  END IF;

  IF v_tip < 0 OR v_tip > p_amount THEN
    RAISE EXCEPTION 'Tip must be between 0 and the expense amount';
  END IF;

  v_split_count := jsonb_array_length(p_splits);
  IF v_split_count IS NULL OR v_split_count < 1 THEN
    RAISE EXCEPTION 'At least one split member required';
  END IF;

  IF v_split_count > 50 THEN
    RAISE EXCEPTION 'Too many splits (maximum 50)';
  END IF;

  IF p_split_method NOT IN ('even', 'exact', 'shares', 'cover') THEN
    RAISE EXCEPTION 'Invalid split method: %', p_split_method;
  END IF;

  -- Every split member must be a real trip member OR the "Deleted User" sentinel (a departed
  -- member's historical share, resubmitted unchanged — see this migration's header comment). This
  -- is the exact check that made editing an expense with such a share fail outright before this
  -- migration, even for a save that only changed the title.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) e
    LEFT JOIN public.trip_members tm
      ON tm.trip_id = v_trip_id AND tm.user_id = (e->>'user_id')::UUID
    WHERE tm.user_id IS NULL
      AND (e->>'user_id')::UUID != '00000000-0000-0000-0000-000000000000'::UUID
  ) THEN
    RAISE EXCEPTION 'All split members must be trip members';
  END IF;

  IF p_split_method = 'exact' THEN
    SELECT COALESCE(SUM((e->>'amount')::NUMERIC), 0)
      INTO v_sum_check
      FROM jsonb_array_elements(p_splits) e;
    IF ROUND(v_sum_check, 2) != ROUND(p_amount, 2) THEN
      RAISE EXCEPTION 'Split amounts (%) do not sum to expense amount (%)', v_sum_check, p_amount;
    END IF;
  END IF;

  IF p_split_method = 'shares' THEN
    SELECT COALESCE(SUM((e->>'shares')::INT), 0)
      INTO v_total_shares
      FROM jsonb_array_elements(p_splits) e;
    IF v_total_shares <= 0 THEN
      RAISE EXCEPTION 'Total shares must be greater than zero';
    END IF;
  END IF;

  IF p_split_method = 'cover' THEN
    IF v_split_count != 1 THEN
      RAISE EXCEPTION 'Cover method requires exactly one split entry';
    END IF;
    IF (p_splits->0->>'user_id')::UUID = p_paid_by THEN
      RAISE EXCEPTION 'Cannot cover yourself';
    END IF;
  END IF;

  -- ── FX: resolve exchange_rate / converted_amount, frozen at write time ──────
  SELECT base_currency INTO v_base_currency FROM public.trips WHERE id = v_trip_id;

  IF v_currency = v_base_currency THEN
    v_exchange_rate := 1;
  ELSE
    v_rate_base   := private.get_latest_exchange_rate(v_base_currency);
    v_rate_target := private.get_latest_exchange_rate(v_currency);
    IF v_rate_base IS NULL OR v_rate_target IS NULL THEN
      RAISE EXCEPTION 'Exchange rate unavailable for % -> %', v_currency, v_base_currency;
    END IF;
    v_exchange_rate := v_rate_base / v_rate_target;
  END IF;

  v_converted_amt := ROUND(p_amount * v_exchange_rate, 2);

  UPDATE public.expenses
     SET title            = p_title,
         description      = CASE
                               WHEN p_description IS NULL THEN description
                               WHEN p_description = '' THEN NULL
                               ELSE p_description
                             END,
         amount           = p_amount,
         currency         = v_currency,
         paid_by          = p_paid_by,
         related_type     = COALESCE(p_related_type, related_type),
         split_method     = p_split_method,
         updated_by       = v_caller,
         exchange_rate    = v_exchange_rate,
         converted_amount = v_converted_amt,
         is_business      = COALESCE(p_is_business, is_business),
         tip_amount       = v_tip
   WHERE id = p_expense_id;

  DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;

  IF p_split_method = 'even' THEN
    v_even_amt := ROUND(p_amount / v_split_count, 2);
  END IF;

  FOR v_i IN 0..(v_split_count - 1) LOOP
    v_entry := p_splits->v_i;
    v_user_id := (v_entry->>'user_id')::UUID;

    CASE p_split_method
      WHEN 'even' THEN
        IF v_i = v_split_count - 1 THEN
          v_amount := p_amount - v_running;
        ELSE
          v_amount := v_even_amt;
        END IF;
      WHEN 'exact' THEN
        v_amount := ROUND((v_entry->>'amount')::NUMERIC, 2);
      WHEN 'shares' THEN
        v_shares_val := (v_entry->>'shares')::INT;
        IF v_i = v_split_count - 1 THEN
          v_amount := p_amount - v_running;
        ELSE
          v_amount := ROUND(p_amount * v_shares_val / v_total_shares, 2);
        END IF;
      WHEN 'cover' THEN
        v_amount := p_amount;
    END CASE;

    v_running := v_running + v_amount;
    v_owed_base := ROUND(v_amount * v_exchange_rate, 2);

    INSERT INTO public.expense_splits (expense_id, user_id, amount_owed, status, amount_owed_original_currency)
    VALUES (
      p_expense_id,
      v_user_id,
      v_owed_base,
      CASE WHEN v_user_id = p_paid_by THEN 'settled' ELSE 'open' END,
      CASE WHEN v_currency = v_base_currency THEN NULL ELSE v_amount END
    );
  END LOOP;
END;
$$;
