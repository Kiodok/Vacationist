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
// history, so this selects the most recent as_of per currency rather than the whole table.
export async function getLatestExchangeRates(): Promise<ExchangeRate[]> {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('currency, rate, as_of')
    .order('as_of', { ascending: false });

  if (error) throw error;

  const latestByCode = new Map<string, ExchangeRate>();
  for (const row of (data ?? []) as ExchangeRate[]) {
    if (!latestByCode.has(row.currency)) {
      latestByCode.set(row.currency, row);
    }
  }
  return Array.from(latestByCode.values());
}
