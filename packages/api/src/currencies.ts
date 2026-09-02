import { supabase } from './client';
import type { CurrencyCatalogEntry, ExchangeRate } from '@vacationist/types';

export async function getCurrencies(): Promise<CurrencyCatalogEntry[]> {
  const { data, error } = await supabase
    .from('currency_catalog')
    .select('code, name, symbol, is_rate_available, is_active')
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CurrencyCatalogEntry[];
}

// Latest rate per currency (one row each, EUR-relative). exchange_rates keeps full daily
// history (450+ rows and growing ~25/day) — the dedupe to "one row per currency" happens in
// Postgres via the get_latest_exchange_rates() RPC, not by fetching the whole table to the
// client. See supabase/migrations/20260902100000_get_latest_exchange_rates_rpc.sql.
export async function getLatestExchangeRates(): Promise<ExchangeRate[]> {
  const { data, error } = await supabase.rpc('get_latest_exchange_rates');

  if (error) throw error;
  return (data ?? []) as ExchangeRate[];
}
