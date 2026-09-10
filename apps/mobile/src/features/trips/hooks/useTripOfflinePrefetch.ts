import { useEffect, useRef } from 'react';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { Image } from 'expo-image';
import NetInfo from '@react-native-community/netinfo';
import {
  getAccommodations,
  getActivitiesPage,
  getAllActivities,
  getAllExpenses,
  getCurrencies,
  getExpenses,
  getLatestExchangeRates,
  getLostFoundCases,
  getNotes,
  getPackingItems,
  getSharedPackingItems,
  getShoppingLists,
  getTransferFlights,
  getTransferPublicTransport,
  getTransferRentals,
  getTransferVehicles,
  getTripBalances,
  getTripCostSummary,
  getTripMembers,
  getTripMessages,
} from '@vacationist/api';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { runWithConcurrency } from '../../../utils/concurrency';

/**
 * When a trip screen opens while online, warm every tab's primary query in the
 * background so the whole trip is usable offline afterwards — no "Download for
 * offline" button, no per-tab visit required (Phase 19). Runs at most once per
 * trip per foreground session; re-runs opportunistically when connectivity
 * returns while a trip is open.
 *
 * Only tab-level lists are prefetched, not every sub-entity (votes, passengers,
 * per-item documents) — those are combinatorial and load fast once their parent
 * list is cached and the screen mounts.
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

    const run = async () => {
      const plain: Array<[readonly unknown[], () => Promise<unknown>]> = [
        [['trips', tripId, 'members'], () => getTripMembers(tripId)],
        [['trips', tripId, 'accommodations'], () => getAccommodations(tripId)],
        [['trips', tripId, 'activities', 'all'], () => getAllActivities(tripId)],
        [['trips', tripId, 'transfer-flights'], () => getTransferFlights(tripId)],
        [['trips', tripId, 'transfer-vehicles'], () => getTransferVehicles(tripId)],
        [['trips', tripId, 'transfer-rentals'], () => getTransferRentals(tripId)],
        [['trips', tripId, 'transfer-public-transport'], () => getTransferPublicTransport(tripId)],
        [['trips', tripId, 'notes'], () => getNotes(tripId)],
        [['trips', tripId, 'packing-items'], () => getPackingItems(tripId)],
        [['trips', tripId, 'shared-packing-items'], () => getSharedPackingItems(tripId)],
        [['trips', tripId, 'lost-found'], () => getLostFoundCases(tripId)],
        [['trips', tripId, 'shopping-lists'], () => getShoppingLists(tripId)],
        [['trips', tripId, 'expenses', 'all'], () => getAllExpenses(tripId)],
        [['trips', tripId, 'balances'], () => getTripBalances(tripId)],
        [['trips', tripId, 'cost-summary'], () => getTripCostSummary(tripId)],
        [['currencies'], () => getCurrencies()],
        [['exchangeRates'], () => getLatestExchangeRates()],
      ];

      // Bounded fan-out (v1.37.3) — ~20 prefetches incl. two whole-trip fetches
      // used to fire at once, a network + parse + memory burst 1.2 s after every
      // trip open. Cap at 4 in flight; order doesn't matter here.
      const tasks: Array<() => Promise<unknown>> = [
        ...plain.map(([queryKey, queryFn]) =>
          () => queryClient.prefetchQuery({ queryKey, queryFn }),
        ),
        () => queryClient.prefetchInfiniteQuery({
          queryKey: ['trips', tripId, 'activities'],
          queryFn: ({ pageParam }) => getActivitiesPage(tripId, (pageParam as number) ?? 0),
          initialPageParam: 0,
        }),
        () => queryClient.prefetchInfiniteQuery({
          queryKey: ['trips', tripId, 'expenses'],
          queryFn: ({ pageParam }) => getExpenses(tripId, (pageParam as number) ?? 0),
          initialPageParam: 0,
        }),
        () => queryClient.prefetchInfiniteQuery({
          queryKey: ['trips', tripId, 'messages'],
          queryFn: ({ pageParam }) => getTripMessages(tripId, pageParam as string | undefined),
          initialPageParam: undefined as string | undefined,
        }),
      ];
      await runWithConcurrency(tasks, 4);

      if (cancelled) return;

      // Warm member avatars into the on-disk image cache — but not over a
      // metered/roaming connection (image bytes dwarf the JSON above).
      try {
        const net = await NetInfo.fetch();
        if (net.details && 'isConnectionExpensive' in net.details && net.details.isConnectionExpensive) {
          return;
        }
        const members = queryClient.getQueryData<Array<{ user?: { avatar_url?: string | null } }>>([
          'trips',
          tripId,
          'members',
        ]);
        const urls = (members ?? [])
          .map((m) => m.user?.avatar_url)
          .filter((u): u is string => !!u);
        if (urls.length > 0) {
          await Image.prefetch(urls, { cachePolicy: 'disk' });
        }
      } catch {
        // image prefetch is best-effort
      }
    };

    // Defer so it never competes with the tab the user actually tapped.
    const t = setTimeout(() => {
      void run();
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tripId, isConnected, queryClient]);
}
