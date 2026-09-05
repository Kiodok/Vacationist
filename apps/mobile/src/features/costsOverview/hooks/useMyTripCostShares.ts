import { useQuery } from '@tanstack/react-query';
import { getMyTripCostShares } from '@vacationist/api';
import { computeMyCostShares, type MyCostSharesResult } from '@vacationist/utils';
import { useAuthStore } from '../../../stores/authStore';
import { useExchangeRates } from '../../currencies/hooks/useCurrencies';

/**
 * Global Analytics tab (v1.34.0 item 2) — the RPC returns raw per-trip, per-source rows across
 * every trip the user belongs to; computeMyCostShares (@vacationist/utils) does the real work
 * (passenger-gated flight shares, even-split shares, year bucketing, currency conversion), kept
 * pure so it's exhaustively unit tested (see packages/utils/src/costSummary.test.ts).
 *
 * Falls back to EUR (the app's overall default currency, matching `trips.base_currency`'s own
 * default) when the user hasn't set a preferred currency in Profile settings.
 */
export function useMyTripCostShares() {
  const preferredCurrency = useAuthStore((s) => s.user?.preferred_currency);
  const displayCurrency = preferredCurrency ?? 'EUR';

  const rowsQuery = useQuery({
    queryKey: ['me', 'trip-cost-shares'],
    queryFn: getMyTripCostShares,
    staleTime: 60_000,
    retry: 2,
  });
  const ratesQuery = useExchangeRates();

  const rateByCode = Object.fromEntries((ratesQuery.data ?? []).map((r) => [r.currency, r.rate]));
  const data: MyCostSharesResult | undefined = rowsQuery.data
    ? computeMyCostShares(rowsQuery.data, rateByCode, displayCurrency)
    : undefined;

  return {
    ...rowsQuery,
    data,
    displayCurrency,
    // Overridden (not just isLoading) so getQueryDisplayState (reads isPending) also waits on
    // rates — see the identical race documented in useTripCostSummary.ts.
    isPending: rowsQuery.isPending || ratesQuery.isPending,
    isLoading: rowsQuery.isLoading || ratesQuery.isLoading,
  };
}
