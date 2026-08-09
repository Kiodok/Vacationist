import { useQuery } from '@tanstack/react-query';
import { getCurrencies, getLatestExchangeRates } from '@vacationist/api';
import { convertAmount } from '@vacationist/utils';
import type { CurrencyCatalogEntry } from '@vacationist/types';

// Reference data — safe to cache aggressively and persist (non-sensitive, changes at most
// daily via the fetch-exchange-rates cron). staleTime intentionally long since this list
// only changes when a currency is added/removed from the catalog, which is a rare event by
// design (see currency_drift_alerts).
export function useCurrencies() {
  return useQuery<CurrencyCatalogEntry[]>({
    queryKey: ['currencies'],
    queryFn: getCurrencies,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchangeRates'],
    queryFn: getLatestExchangeRates,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

interface UseCurrencyConversionResult {
  /** Converts an amount from one currency to another using the latest cached rates. Returns null if either rate is unavailable. */
  convert: (amount: number, from: string, to: string) => number | null;
  /** Most recent as_of date across all cached rates — shown as a "rates as of" footnote. */
  ratesAsOf: string | null;
  isLoading: boolean;
}

export function useCurrencyConversion(): UseCurrencyConversionResult {
  const { data: rates, isLoading } = useExchangeRates();

  const rateByCode = new Map((rates ?? []).map((r) => [r.currency, r.rate]));
  const ratesAsOf = (rates ?? []).reduce<string | null>(
    (latest, r) => (!latest || r.as_of > latest ? r.as_of : latest),
    null,
  );

  const convert = (amount: number, from: string, to: string): number | null => {
    if (from === to) return amount;
    const rateFrom = rateByCode.get(from);
    const rateTo = rateByCode.get(to);
    if (rateFrom == null || rateTo == null) return null;
    return convertAmount(amount, rateFrom, rateTo);
  };

  return { convert, ratesAsOf, isLoading };
}
