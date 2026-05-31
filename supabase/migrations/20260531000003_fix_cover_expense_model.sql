-- Fix cover expense model: swap paid_by ↔ split consumer so that
-- the covered person is paid_by (improves their net balance) and
-- the actual payer is the split consumer with status='open'
-- (reduces their net balance by the cover amount).
--
-- Before: paid_by=Gary, split user=Gabriel (Gabriel owes Gary → debt increases)
-- After:  paid_by=Gabriel, split user=Gary   (Gabriel's total_paid increases → debt decreases)

DO $$
DECLARE
  r            RECORD;
  v_old_payer  UUID;
  v_old_ower   UUID;
BEGIN
  FOR r IN
    SELECT e.id,
           e.paid_by           AS old_payer,
           es.user_id          AS old_ower
    FROM   public.expenses e
    JOIN   public.expense_splits es ON es.expense_id = e.id
    WHERE  e.split_method = 'cover'
  LOOP
    v_old_payer := r.old_payer;
    v_old_ower  := r.old_ower;

    -- Set paid_by to the covered person (was the split consumer)
    UPDATE public.expenses
       SET paid_by = v_old_ower
     WHERE id = r.id;

    -- Set split consumer to the actual payer; mark open for balance tracking
    UPDATE public.expense_splits
       SET user_id = v_old_payer,
           status  = 'open'
     WHERE expense_id = r.id;
  END LOOP;
END $$;
