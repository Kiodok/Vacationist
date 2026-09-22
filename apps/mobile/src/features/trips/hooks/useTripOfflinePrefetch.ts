import { useEffect, useRef } from 'react';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { prefetchTripData } from '../../../utils/offlinePrefetch';

/**
 * When a trip screen opens while online, make sure that trip is fully cached for offline use — the
 * catch-all for trips the automatic pass (`useGlobalOfflinePrefetch`) skips on purpose: completed and
 * archived ones. For a planning/ongoing trip the global pass has usually done this already, and this
 * is a cheap top-up (fresh queries are not refetched).
 *
 * Runs at most once per trip per foreground session; re-runs opportunistically when connectivity
 * returns while a trip is open. The download itself lives in `utils/offlinePrefetch.ts`.
 */
export function useTripOfflinePrefetch(tripId: string | undefined) {
  const queryClient = useQueryClient();
  const { isConnected } = useNetworkStatus();
  const doneFor = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!tripId) return;
    if (isConnected === false) return;
    if (!onlineManager.isOnline()) return;
    if (doneFor.current.has(tripId)) return;
    doneFor.current.add(tripId);

    let cancelled = false;

    // Defer so it never competes with the tab the user actually tapped.
    const t = setTimeout(() => {
      void prefetchTripData(queryClient, tripId, () => cancelled);
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tripId, isConnected, queryClient]);
}
