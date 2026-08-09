-- Phase 15: Multi-Currency Expense Support — Step 4: currency columns → FK to currency_catalog
--
-- Replaces the three hardcoded CHECK ('EUR','CHF','USD') constraints with a foreign key into
-- the new reference table. Non-destructive: every existing row's currency is EUR, CHF, or
-- USD, all three of which exist in the currency_catalog seed, so the FK is satisfied
-- immediately with no data changes.
--
-- PostgreSQL auto-names inline CHECK constraints as <table>_<column>_check (documented in
-- 20260612140000_add_usd_currency.sql, which last touched these same three constraints).

ALTER TABLE public.trips
  DROP CONSTRAINT trips_base_currency_check,
  ADD CONSTRAINT trips_base_currency_fkey
    FOREIGN KEY (base_currency) REFERENCES public.currency_catalog(code);

ALTER TABLE public.expenses
  DROP CONSTRAINT expenses_currency_check,
  ADD CONSTRAINT expenses_currency_fkey
    FOREIGN KEY (currency) REFERENCES public.currency_catalog(code);

ALTER TABLE public.settlement_receipts
  DROP CONSTRAINT settlement_receipts_currency_check,
  ADD CONSTRAINT settlement_receipts_currency_fkey
    FOREIGN KEY (currency) REFERENCES public.currency_catalog(code);
