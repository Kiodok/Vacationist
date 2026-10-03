-- v1.39.2 code-review follow-up (2026-10-03): fix auth-check ordering in
-- update_expense_with_splits.
--
-- 20261003100000 added the "settled non-payer split" guard (RAISE EXCEPTION 'Expense has a
-- settled split...') directly after the expense lookup, but BEFORE the trip-membership and
-- permission checks that follow it. That let an authenticated caller who is a member of some
-- OTHER trip, but not this one, learn whether a specific expense (identified only by a guessed
-- or otherwise-obtained id) has a settled split before being told they are not a trip member —
-- a minor authorization-check-ordering / information-disclosure regression. Every other check in
-- this function (and its siblings) runs membership/permission checks first; this one didn't.
--
-- Fix: move the settled-split guard to after the role/permission checks (same relative position
-- it held before, just shifted past them), so a non-member always gets "Not a trip member"
-- first, regardless of the expense's settlement state. No other behavior changes — this is a
-- pure reordering. Body is the live 20261003100000 version verbatim aside from that move. Same
-- signature — CREATE OR REPLACE, no DROP needed.

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
  v_paid_by         UUID;
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

  SELECT trip_id, created_by, tip_amount, paid_by
    INTO v_trip_id, v_created_by, v_existing_tip, v_paid_by
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

  -- v1.39.2 task 2: a settled non-payer split locks amount/currency/tip/paid_by/
  -- split_method/splits — the client should call update_expense_metadata instead once
  -- any split is settled. This is defense in depth against a stale/bypassed client.
  -- Moved here (after the membership/permission checks) in the 20261003130000 follow-up —
  -- see this migration's header comment.
  IF EXISTS (
    SELECT 1 FROM public.expense_splits
     WHERE expense_id = p_expense_id
       AND user_id != v_paid_by
       AND status = 'settled'
  ) THEN
    RAISE EXCEPTION 'Expense has a settled split — unsettle it before changing the amount, payer or split';
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

  -- v1.39.1: make the base-currency splits sum to converted_amount exactly (see header).
  PERFORM private.absorb_split_rounding(p_expense_id, v_converted_amt, p_split_method);
END;
$$;
