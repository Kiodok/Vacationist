-- Auto-settle expenses when all splits are settled.
-- Clears settled_at if any split is reopened.

ALTER TABLE public.expenses
  ADD COLUMN settled_at TIMESTAMPTZ DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.auto_settle_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_total   INT;
  v_settled INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'settled')
    INTO v_total, v_settled
    FROM public.expense_splits
   WHERE expense_id = NEW.expense_id;

  IF v_total > 0 AND v_settled = v_total THEN
    UPDATE public.expenses
       SET settled_at = NOW()
     WHERE id = NEW.expense_id AND settled_at IS NULL;
  ELSE
    UPDATE public.expenses
       SET settled_at = NULL
     WHERE id = NEW.expense_id AND settled_at IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_expense_split_status_change
  AFTER UPDATE OF status ON public.expense_splits
  FOR EACH ROW EXECUTE FUNCTION public.auto_settle_expense();
