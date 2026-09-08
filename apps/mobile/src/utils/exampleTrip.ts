import { queryClient } from './queryClient';
import type { Trip } from '@vacationist/types';

/**
 * True when `tripId` is the auto-seeded demo trip (create-example-trip), per the
 * cached trip data — used to keep demo-trip pokes out of the web-app product-funnel
 * analytics (Growth Plan Q4 2026, Phase 0).
 *
 * Best-effort: if the trip isn't in the query cache we return `false`, i.e. treat
 * it as a real trip and record the event. The demo trip is always in cache on the
 * screens that fire these events (its list/detail query drives the UI), so a miss
 * in practice means a real trip.
 */
export function isCachedExampleTrip(tripId: string | undefined | null): boolean {
  if (!tripId) return false;
  const single = queryClient.getQueryData<Trip>(['trips', tripId]);
  if (single) return single.is_example === true;
  const list = queryClient.getQueryData<Trip[]>(['trips']);
  return list?.find((t) => t.id === tripId)?.is_example === true;
}
