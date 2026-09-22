import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { dayjs } from '@vacationist/utils';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import {
  prefetchGlobalData,
  prefetchTripData,
  isAutoPrefetchTrip,
  isTripPrefetchFresh,
} from '../../../utils/offlinePrefetch';

/** Wait this long after sign-in / app start so the first screen gets the network to itself. */
const START_DELAY_MS = 2500;
/** Don't run the whole pass again on every foreground within this window. */
const MIN_RERUN_MS = 5 * 60 * 1000;

/**
 * Downloads everything the user can navigate to while they still have a connection: the Trips list,
 * global Calendar, Analytics and notifications, then every PLANNING or ONGOING trip in full, one trip
 * at a time. Runs after sign-in, whenever connectivity returns, and when the app comes back to the
 * foreground (throttled) — so "log in online, go offline" and "opened it on the train yesterday" both
 * find a populated cache. Mounted once, in the root layout.
 *
 * Deliberately bounded (see `utils/offlinePrefetch.ts`): capped concurrency, planning/ongoing trips
 * only, a fresh trip is skipped, and the pass aborts as soon as the device drops offline.
 */
export function useGlobalOfflinePrefetch() {
  const queryClient = useQueryClient();
  const hasSession = useAuthStore((s) => s.hasSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { isConnected } = useNetworkStatus();
  const running = useRef(false);
  const lastRun = useRef(0);

  useEffect(() => {
    if (!hasSession || isLoading || isConnected === false) return;

    let cancelled = false;

    const run = async () => {
      if (running.current || cancelled) return;
      if (!onlineManager.isOnline()) return;
      if (Date.now() - lastRun.current < MIN_RERUN_MS) return;
      running.current = true;
      lastRun.current = Date.now();
      try {
        const trips = await prefetchGlobalData(queryClient);
        const today = dayjs().format('YYYY-MM-DD');
        for (const trip of trips) {
          if (cancelled || !onlineManager.isOnline()) break;
          if (!isAutoPrefetchTrip(trip, today) || isTripPrefetchFresh(trip.id)) continue;
          await prefetchTripData(queryClient, trip.id, () => cancelled || !onlineManager.isOnline());
        }
      } catch {
        // Best effort — whatever did not download simply is not cached.
      } finally {
        running.current = false;
      }
    };

    const start = setTimeout(() => void run(), START_DELAY_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });

    return () => {
      cancelled = true;
      clearTimeout(start);
      appState.remove();
    };
  }, [hasSession, isLoading, isConnected, queryClient]);
}
