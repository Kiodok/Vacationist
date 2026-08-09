-- Phase 15b: Broaden FX coverage — source tracking + BGN retirement
--
-- 1. source column: exchange_rates has, until now, only ever been written by the Frankfurter
--    (ECB) fetch. The fetch-exchange-rates Edge Function is being extended to also pull from
--    open.er-api.com (ExchangeRate-API's free, no-key, once-daily "open access" endpoint —
--    verified live to cover all 12 currencies Frankfurter doesn't price) as a secondary
--    source for currencies Frankfurter has no rate for at all. Frankfurter stays primary for
--    every currency it does price. Existing rows correctly default to 'ecb' — that is
--    genuinely where every rate stored so far came from.
--
-- 2. BGN retirement: verified via the European Council and ECB (see engineering/supabase.md
--    for sources) that Bulgaria adopted the euro on 1 January 2026, with the cash changeover
--    completed and the euro as sole legal currency since 1 February 2026 — BGN is no longer
--    a real-world currency to transact in, not merely "temporarily unpriced" by our feeds.
--    This is exactly the scenario currency_catalog.is_active (distinct from is_rate_available)
--    was designed for in Phase 15. Notably, open.er-api.com still returns a BGN rate (a static
--    echo of the fixed 1.95583 conversion peg, not a live traded rate) — the automated
--    drift-detection system cannot infer "this currency is retired" from feed data alone, so
--    this is a deliberate one-time data change, not something the Edge Function does itself.
--    Soft-disable only: existing BGN-denominated trips/expenses are completely untouched.

ALTER TABLE public.exchange_rates
  ADD COLUMN source TEXT NOT NULL DEFAULT 'ecb' CHECK (source IN ('ecb', 'exchangerate-api'));

UPDATE public.currency_catalog SET is_active = false WHERE code = 'BGN';
