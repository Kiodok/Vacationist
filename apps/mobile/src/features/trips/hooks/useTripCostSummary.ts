import { useQuery } from '@tanstack/react-query';
import { getTripCostSummary } from '@vacationist/api';
import { computeTripCostSummary, type CostSummaryResult } from '@vacationist/utils';
import { useExchangeRates } from '../../currencies/hooks/useCurrencies';

/**
 * Trip Overview cost summary card (v1.34.0 items 7/8) — the RPC returns raw per-(source,
 * currency) rows; computeTripCostSummary (@vacationist/utils) does the real work (category-level
 * precedence, currency conversion), kept as a pure function so it's exhaustively unit tested
 * without a live DB/network (see packages/utils/src/costSummary.test.ts).
 *
 * `displayCurrency` is whatever the caller wants the total converted into — pass
 * `user.preferred_currency ?? trip.base_currency` per the product decision that the summary
 * shows in the member's preferred currency when they've set one, falling back to the trip's own
 * currency otherwise. There's nothing base-currency-specific about computeTripCostSummary itself
 * (it just converts every row into whatever currency it's given), so no second conversion pass
 * is needed on top of this hook's result.
 */
export function useTripCostSummary(tripId: string, displayCurrency: string) {
  const rowsQuery = useQuery({
    queryKey: ['trips', tripId, 'cost-summary'],
    queryFn: () => getTripCostSummary(tripId),
    staleTime: 60_000,
    retry: 2,
    enabled: !!tripId,
  });
  const ratesQuery = useExchangeRates();

  const rateByCode = Object.fromEntries((ratesQuery.data ?? []).map((r) => [r.currency, r.rate]));
  const data: CostSummaryResult | undefined = rowsQuery.data
    ? computeTripCostSummary(rowsQuery.data, rateByCode, displayCurrency)
    : undefined;

  return {
    ...rowsQuery,
    data,
    // Overridden (not just isLoading) so shared display-state helpers like getQueryDisplayState,
    // which read isPending, also wait on rates — rowsQuery can resolve before exchange rates do,
    // and computeTripCostSummary would otherwise run once against an incomplete rate map and
    // briefly show cross-currency rows as excluded until rates arrive and this re-renders.
    isPending: rowsQuery.isPending || ratesQuery.isPending,
    isLoading: rowsQuery.isLoading || ratesQuery.isLoading,
  };
}
