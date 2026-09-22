import type { QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import NetInfo from '@react-native-community/netinfo';
import type { Trip } from '@vacationist/types';
import {
  getAccommodations,
  getActivitiesForTrips,
  getActivitiesPage,
  getActivityVotesForTrips,
  getAllActivities,
  getAllExpenses,
  getAllShoppingItemsForTrip,
  getCurrencies,
  getCurrentMemberRole,
  getExpenses,
  getLatestExchangeRates,
  getLostFoundCases,
  getMyTripCostShares,
  getAccommodationVotes,
  getMyTopicPreferences,
  getNotes,
  getNotifications,
  getPackingItems,
  getPreworkTopics,
  getRecipes,
  getSharedPackingItems,
  getShoppingItems,
  getShoppingLists,
  getTopicPreferences,
  getTransferFlights,
  getTransferFlightVotes,
  getTransferPublicTransport,
  getTransferRentals,
  getTransferVehicles,
  getTrip,
  getTripActivityVotes,
  getTripBalances,
  getTripCostSummary,
  getTripMembers,
  getTripMessages,
  getTripTabContent,
  getTrips,
} from '@vacationist/api';
import { runWithConcurrency } from './concurrency';

/**
 * Background "download for offline" — no button, no per-tab visit required (Phase 19, extended in
 * v1.39.0 after device testing called the caching "unpredictable and not robust").
 *
 * The old behaviour only cached a trip when it was OPENED while online, and never touched the Trips
 * list, the global Calendar, Analytics, the notification list, or a trip's header/role queries. So
 * "log in online, switch on flight mode, open the app" landed on empty states for anything not
 * visited before. Now everything the user can navigate to is fetched proactively:
 *   - `prefetchGlobalData`  — Trips list, global Calendar (+ votes), Analytics, notifications, FX
 *   - `prefetchTripData`    — one trip, every tab's primary list + header/role/tab flags + every
 *                             shopping list's items
 *
 * Bounded on purpose (v1.37.3 memory constraint): at most 4 requests in flight, one trip at a time,
 * and only planning/ongoing trips are downloaded automatically — a completed trip is cached when it
 * is opened, so the on-disk blob doesn't grow with every old holiday.
 */

const CONCURRENCY = 4;

/** A trip fetched this recently is not fetched again by the automatic pass. */
export const PREFETCH_FRESH_MS = 5 * 60 * 1000;
const lastTripPrefetch = new Map<string, number>();

export function isTripPrefetchFresh(tripId: string, now = Date.now()): boolean {
  const at = lastTripPrefetch.get(tripId);
  return at !== undefined && now - at < PREFETCH_FRESH_MS;
}

/** Trips worth downloading unprompted: still being planned, or under way. */
export function isAutoPrefetchTrip(trip: Pick<Trip, 'status' | 'start_date' | 'end_date'>, today: string): boolean {
  if (trip.status === 'archived' || trip.status === 'completed') return false;
  return trip.end_date >= today; // planning or ongoing; a trip that ended without being closed is history
}

type Task = () => Promise<unknown>;

/** Everything not tied to one trip. Resolves to the cached trips (possibly stale) for the per-trip pass. */
export async function prefetchGlobalData(qc: QueryClient): Promise<Trip[]> {
  await qc.prefetchQuery({ queryKey: ['trips'], queryFn: getTrips });
  const trips = qc.getQueryData<Trip[]>(['trips']) ?? [];
  const tripIds = trips.map((t) => t.id).sort();

  const tasks: Task[] = [
    () => qc.prefetchQuery({ queryKey: ['currencies'], queryFn: getCurrencies }),
    () => qc.prefetchQuery({ queryKey: ['exchangeRates'], queryFn: getLatestExchangeRates }),
    () => qc.prefetchQuery({ queryKey: ['notifications'], queryFn: () => getNotifications() }),
    // Analytics tab
    () => qc.prefetchQuery({ queryKey: ['me', 'trip-cost-shares'], queryFn: getMyTripCostShares }),
  ];
  if (tripIds.length > 0) {
    // Global Calendar — keys must match useGlobalCalendarActivities / useActivityVotesForTrips exactly.
    tasks.push(
      () => qc.prefetchQuery({ queryKey: ['global-calendar-activities', tripIds], queryFn: () => getActivitiesForTrips(tripIds) }),
      () => qc.prefetchQuery({ queryKey: ['activity-votes', 'trips', ...tripIds], queryFn: () => getActivityVotesForTrips(tripIds) }),
    );
  }
  await runWithConcurrency(tasks, CONCURRENCY);
  return trips;
}

/**
 * Download one trip. `shouldStop` lets a caller abort between phases (offline again, unmounted).
 * Never throws — a failed query simply stays uncached, exactly like the previous per-trip behaviour.
 */
export async function prefetchTripData(qc: QueryClient, tripId: string, shouldStop: () => boolean = () => false): Promise<void> {
  const plain: Array<[readonly unknown[], () => Promise<unknown>]> = [
    // Header, the viewer's role and the tab "has content" flags — a trip screen renders nothing
    // useful (or the offline empty state) without these three.
    [['trips', tripId], () => getTrip(tripId)],
    [['trips', tripId, 'role'], () => getCurrentMemberRole(tripId)],
    [['trips', tripId, 'tab-content'], () => getTripTabContent(tripId)],
    [['trips', tripId, 'members'], () => getTripMembers(tripId)],
    [['trips', tripId, 'accommodations'], () => getAccommodations(tripId)],
    [['trips', tripId, 'activities', 'all'], () => getAllActivities(tripId)],
    [['trips', tripId, 'activity-votes'], () => getTripActivityVotes(tripId)],
    [['trips', tripId, 'transfer-flights'], () => getTransferFlights(tripId)],
    [['trips', tripId, 'transfer-vehicles'], () => getTransferVehicles(tripId)],
    [['trips', tripId, 'transfer-rentals'], () => getTransferRentals(tripId)],
    [['trips', tripId, 'transfer-public-transport'], () => getTransferPublicTransport(tripId)],
    [['trips', tripId, 'notes'], () => getNotes(tripId)],
    [['trips', tripId, 'packing-items'], () => getPackingItems(tripId)],
    [['trips', tripId, 'shared-packing-items'], () => getSharedPackingItems(tripId)],
    [['trips', tripId, 'lost-found'], () => getLostFoundCases(tripId)],
    [['trips', tripId, 'shopping-lists'], () => getShoppingLists(tripId)],
    // The "All Items" tab is its own query; without this, opening it offline for the first time
    // renders the offline empty state even though every list was prefetched.
    [['trips', tripId, 'all-shopping-items'], () => getAllShoppingItemsForTrip(tripId)],
    [['trips', tripId, 'expenses', 'all'], () => getAllExpenses(tripId)],
    [['trips', tripId, 'balances'], () => getTripBalances(tripId)],
    [['trips', tripId, 'cost-summary'], () => getTripCostSummary(tripId)],
    // Prework and Recipes had no prefetch entry at all before v1.39.0 round 3 — Prework showed
    // nothing offline, and (combined with the getQueryDisplayState fix) a false "no topics yet".
    [['trips', tripId, 'prework-topics'], () => getPreworkTopics(tripId)],
    [['trips', tripId, 'recipes'], () => getRecipes(tripId)],
    [['currencies'], () => getCurrencies()],
    [['exchangeRates'], () => getLatestExchangeRates()],
  ];

  const tasks: Task[] = [
    ...plain.map(([queryKey, queryFn]) => () => qc.prefetchQuery({ queryKey, queryFn })),
    () => qc.prefetchInfiniteQuery({
      queryKey: ['trips', tripId, 'activities'],
      queryFn: ({ pageParam }) => getActivitiesPage(tripId, (pageParam as number) ?? 0),
      initialPageParam: 0,
    }),
    () => qc.prefetchInfiniteQuery({
      queryKey: ['trips', tripId, 'expenses'],
      queryFn: ({ pageParam }) => getExpenses(tripId, (pageParam as number) ?? 0),
      initialPageParam: 0,
    }),
    () => qc.prefetchInfiniteQuery({
      queryKey: ['trips', tripId, 'messages'],
      queryFn: ({ pageParam }) => getTripMessages(tripId, pageParam as string | undefined),
      initialPageParam: undefined as string | undefined,
    }),
  ];
  await runWithConcurrency(tasks, CONCURRENCY);
  if (shouldStop()) return;

  // Each list's items, from the lists just fetched. An unopened list otherwise has no cache, and an
  // item added to it offline had nowhere to show up.
  const lists = qc.getQueryData<Array<{ id: string }>>(['trips', tripId, 'shopping-lists']) ?? [];
  // Each prework topic's preference queries — same reason: topic-scoped keys, not fetched by the
  // trip-level 'prework-topics' query above.
  const topics = qc.getQueryData<Array<{ id: string }>>(['trips', tripId, 'prework-topics']) ?? [];
  // Accommodation and flight votes have no trip-level batch query (unlike activities, seeded
  // below), so each entity's votes are fetched individually — the only way to make casting a vote
  // on one show up immediately while offline (v1.39.0 round 3).
  const accommodations = qc.getQueryData<Array<{ id: string }>>(['trips', tripId, 'accommodations']) ?? [];
  const flights = qc.getQueryData<Array<{ id: string }>>(['trips', tripId, 'transfer-flights']) ?? [];
  await runWithConcurrency(
    [
      ...lists.map((l) => () => qc.prefetchQuery({ queryKey: ['shopping-lists', l.id, 'items'], queryFn: () => getShoppingItems(l.id) })),
      ...topics.flatMap((t) => [
        () => qc.prefetchQuery({ queryKey: ['prework-topics', t.id, 'preferences'], queryFn: () => getTopicPreferences(t.id) }),
        () => qc.prefetchQuery({ queryKey: ['prework-topics', t.id, 'my-preferences'], queryFn: () => getMyTopicPreferences(t.id) }),
      ]),
      ...accommodations.map((a) => () => qc.prefetchQuery({ queryKey: ['accommodations', a.id, 'votes'], queryFn: () => getAccommodationVotes(a.id) })),
      ...flights.map((f) => () => qc.prefetchQuery({ queryKey: ['transfer-flights', f.id, 'votes'], queryFn: () => getTransferFlightVotes(f.id) })),
    ],
    CONCURRENCY,
  );

  // Seed each activity's OWN votes cache from the trip-level batch already fetched above — cheaper
  // than N individual fetches, and the batch's whole reason to exist. Without this, casting a vote
  // offline (on `useActivityVotes(activityId)`, the key `VoteSheet` actually renders from) had no
  // cache to optimistically update into and silently produced no visible change.
  const activityVotes = qc.getQueryData<Array<{ activity_id: string }>>(['trips', tripId, 'activity-votes']);
  if (activityVotes) {
    const byActivity = new Map<string, typeof activityVotes>();
    for (const v of activityVotes) {
      const list = byActivity.get(v.activity_id);
      if (list) list.push(v);
      else byActivity.set(v.activity_id, [v]);
    }
    for (const [activityId, votes] of byActivity) {
      qc.setQueryData(['activities', activityId, 'votes'], votes);
    }
  }

  lastTripPrefetch.set(tripId, Date.now());
  if (shouldStop()) return;

  // Warm member avatars into the on-disk image cache — but not over a metered/roaming connection
  // (image bytes dwarf the JSON above).
  try {
    const net = await NetInfo.fetch();
    if (net.details && 'isConnectionExpensive' in net.details && net.details.isConnectionExpensive) return;
    const members = qc.getQueryData<Array<{ user?: { avatar_url?: string | null } }>>(['trips', tripId, 'members']);
    const urls = (members ?? []).map((m) => m.user?.avatar_url).filter((u): u is string => !!u);
    if (urls.length > 0) await Image.prefetch(urls, { cachePolicy: 'disk' });
  } catch {
    // image prefetch is best-effort
  }
}
