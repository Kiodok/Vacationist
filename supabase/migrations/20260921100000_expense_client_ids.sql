-- v1.39.0 (device-test round 2): client-generated ids for expenses created offline.
--
-- Why: an expense created offline was inserted into the cache under a throwaway `__optimistic-` id that
-- the server never knew. Anything queued behind it (edit, archive, settle) targeted a row that did not
-- exist yet, and after a restart the placeholder had to be guessed back into the right cache entry.
-- The app now mints the UUID on the device and sends it as `p_id`, so the placeholder, the queued
-- mutation and the stored row are one and the same.
--
-- Change: `create_expense_with_splits` gains a trailing `p_id UUID DEFAULT NULL`.
--   * NULL (older app builds)  -> the id is generated server-side exactly as before.
--   * set                      -> used as the primary key; a replay of an id that already exists for
--                                 this caller in this trip returns it unchanged (at-least-once safe).
--
-- The previous 12-argument overload is dropped first: CREATE OR REPLACE with a different argument list
-- would leave BOTH overloads and PostgREST reports the call as ambiguous (see engineering/supabase.md).
-- Backwards compatible — an old client calling without p_id resolves to the new function via defaults.

DROP FUNCTION IF EXISTS public.create_expense_with_splits(UUID, TEXT, NUMERIC, TEXT, UUID, TEXT, UUID, TEXT, JSONB, TEXT, BOOLEAN, NUMERIC);

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

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) e
    LEFT JOIN public.trip_members tm
      ON tm.trip_id = p_trip_id AND tm.user_id = (e->>'user_id')::UUID
    WHERE tm.user_id IS NULL
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
