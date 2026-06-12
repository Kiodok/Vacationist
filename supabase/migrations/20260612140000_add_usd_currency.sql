-- Add USD as a supported currency alongside EUR and CHF.
-- PostgreSQL auto-names inline CHECK constraints as <table>_<column>_check.

ALTER TABLE public.trips
  DROP CONSTRAINT trips_base_currency_check,
  ADD CONSTRAINT trips_base_currency_check
    CHECK (base_currency IN ('EUR', 'CHF', 'USD'));

ALTER TABLE public.expenses
  DROP CONSTRAINT expenses_currency_check,
  ADD CONSTRAINT expenses_currency_check
    CHECK (currency IN ('EUR', 'CHF', 'USD'));
