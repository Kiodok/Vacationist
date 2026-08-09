-- Phase 15: Multi-Currency Expense Support — Step 6: actually enforce the base-currency lock
--
-- engineering/software_engineering_guide.md has always documented "the base currency cannot
-- be changed after the first expense is added to the trip," but this was never enforced
-- anywhere in code — EditTripSheet's currency picker had no guard, and updateTrip() does a
-- raw `.update(input)` against the trips table via RLS with no check for existing expenses.
-- That was harmless while base_currency was purely cosmetic. It stops being harmless now
-- that expenses.exchange_rate / converted_amount are frozen per-expense against the trip's
-- base currency at entry time (20260809100004) — an after-the-fact base-currency change
-- would silently invalidate every past conversion. This is the authoritative DB-level guard;
-- apps/mobile/src/features/trips/components/EditTripSheet.tsx additionally hides the currency
-- field once the trip has any expenses, so this trigger is a backstop, not the only feedback
-- the user sees.

CREATE OR REPLACE FUNCTION public.restrict_trip_base_currency_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.base_currency IS DISTINCT FROM OLD.base_currency THEN
    IF EXISTS (SELECT 1 FROM public.expenses WHERE trip_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot change base_currency after the first expense has been added';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_trip_update_restrict_base_currency
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.restrict_trip_base_currency_update();
