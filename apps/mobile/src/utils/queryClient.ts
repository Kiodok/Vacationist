import { QueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { useToastStore } from '../stores/toastStore';
import { i18n } from '@vacationist/i18n';
import { isExpectedMutationError } from './errorClassification';

// Keys whose mutations are persisted to MMKV and replayed on reconnect.
// Only include mutations where every needed variable lives in the variables
// object (not in a hook closure), since the persisted payload has no closure.
export const PERSISTED_MUTATION_KEYS = [
  // Activities
  'createActivity',
  'updateActivity',
  'deleteActivity',
  'closeActivityVoting',
  'reopenActivityVoting',
  'castActivityVote',
  'castAccommodationVote',
  'castTransferFlightVote',
  'removeActivityVote',
  'removeAccommodationVote',
  'removeTransferFlightVote',
  // Trips
  'updateTrip',
  // Accommodations
  'createAccommodation',
  'updateAccommodation',
  'deleteAccommodation',
  'bookAccommodation',
  'unbookAccommodation',
  'closeAccommodationVoting',
  'reopenAccommodationVoting',
  // Transfers
  'createTransferFlight',
  'updateTransferFlight',
  'deleteTransferFlight',
  'closeTransferFlightVoting',
  'reopenTransferFlightVoting',
  'bookTransferFlight',
  'createTransferVehicle',
  'updateTransferVehicle',
  'deleteTransferVehicle',
  'createTransferRental',
  'updateTransferRental',
  'deleteTransferRental',
  'createTransferPublicTransport',
  'updateTransferPublicTransport',
  'deleteTransferPublicTransport',
  // Expenses
  'createExpense',
  'updateExpenseWithSplits',
  'archiveExpense',
  'unarchiveExpense',
  'settleExpenseSplit',
  'unsettleExpenseSplit',
  'coverSplit',
  'uncoverSplit',
  'settleAllForPair',
  'settleAllExpenses',
  // Shopping lists
  'createShoppingList',
  'updateShoppingList',
  'archiveShoppingList',
  'unarchiveShoppingList',
  'deleteShoppingList',
  // Shopping items
  'createShoppingItem',
  'updateShoppingItem',
  'updateShoppingItemGlobal',
  'deleteShoppingItem',
  // Packing & lost-found
  'createPackingItem',
  'updatePackingItem',
  'deletePackingItem',
  'createSharedPackingItem',
  'updateSharedPackingItem',
  'claimSharedPackingItem',
  'unclaimSharedPackingItem',
  'deleteSharedPackingItem',
  'createLostFoundCase',
  'updateLostFoundCase',
  'resolveLostFoundCase',
  'unresolveLostFoundCase',
  'deleteLostFoundCase',
  // Trip notes
  'createTripNote',
  'updateTripNote',
  'deleteTripNote',
  'toggleTripNoteDone',
  // Trip chat
  'createTripMessage',
  'updateTripMessage',
  'deleteTripMessage',
  // Notifications
  'markNotificationRead',
  'markAllNotificationsRead',
  'deleteNotification',
  'deleteAllNotifications',
] as const;

export function isPersistedMutationKey(key: unknown): boolean {
  return (PERSISTED_MUTATION_KEYS as readonly unknown[]).includes(key);
}

// v1.34.1 task 1: mutations that change a number the Trip Overview "Trip costs" card
// (get_trip_cost_summary) or the global Analytics tab (get_my_trip_cost_shares) sums. Those two
// queries are keyed OUTSIDE the per-entity key trees, so an entity's own invalidateQueries
// never reaches them — this list drives a single central invalidation in the mutation-cache
// subscriber below (covers active mutations AND persisted replays after a cold start). Passenger
// / ticket mutations aren't defaulted here; they invalidate the cost queries in their own hooks.
const COST_AFFECTING_MUTATION_KEYS = new Set<string>([
  'createExpense', 'updateExpenseWithSplits', 'archiveExpense', 'unarchiveExpense',
  'settleExpenseSplit', 'unsettleExpenseSplit', 'coverSplit', 'uncoverSplit',
  'settleAllForPair', 'settleAllExpenses',
  'createActivity', 'updateActivity', 'deleteActivity', 'closeActivityVoting',
  'createAccommodation', 'updateAccommodation', 'deleteAccommodation',
  'bookAccommodation', 'unbookAccommodation', 'closeAccommodationVoting',
  'createTransferFlight', 'updateTransferFlight', 'deleteTransferFlight', 'bookTransferFlight',
  'createTransferRental', 'updateTransferRental', 'deleteTransferRental',
  'createTransferPublicTransport', 'updateTransferPublicTransport', 'deleteTransferPublicTransport',
]);

/** Invalidate the two cost roll-up queries for a trip (Trip Overview card + Analytics tab). */
export function invalidateCostQueries(tripId: string) {
  if (!tripId) return;
  queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'cost-summary'] });
  queryClient.invalidateQueries({ queryKey: ['me', 'trip-cost-shares'] });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // 30 s: avoids refetch churn on every tab switch/remount. Freshness is
      // preserved by explicit invalidateQueries after mutations, realtime
      // invalidations, and per-screen refetchInterval polling — all of which
      // bypass staleTime.
      staleTime: 30 * 1000,
      // 24 h in-memory retention (v1.37.3, down from 30 d). Offline survival is
      // backed by the PERSISTER's maxAge: 30 d — the disk blob is re-hydrated in
      // full on every launch and mounting a screen re-activates its queries, so a
      // shorter in-memory gcTime costs nothing for the offline-reopen path (JS
      // timers are suspended while backgrounded). It only bounds unbounded cache
      // growth during long continuous foreground sessions.
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 3,
      networkMode: 'offlineFirst',
    },
  },
});

// With networkMode:'offlineFirst', a mutation's first failure while offline
// causes TanStack Query to PAUSE retries (not error) — onError never fires.
// Subscribing to the cache and watching for isPaused is the only reliable
// hook that fires at the right moment to warn the user.
//
// A Set tracks which mutation instances have already shown a toast so we
// don't spam on repeated pause/resume cycles; we reset when isPaused clears.
const pausedMutationsSeen = new Set<unknown>();
// Prevents duplicate Sentry events for the same mutation instance — the
// 'updated' event fires on every state transition, including each retry attempt.
const erroredMutationsSeen = new Set<unknown>();

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === 'removed') {
    pausedMutationsSeen.delete(event.mutation);
    erroredMutationsSeen.delete(event.mutation);
    return;
  }
  if (event.type !== 'updated') return;
  const mut = event.mutation;
  const key = mut.options.mutationKey?.[0];

  // Refresh the cost roll-ups after any cost-affecting mutation succeeds (task 1). Fires for
  // both active mutations and persisted ones replayed after a cold start.
  if (mut.state.status === 'success' && typeof key === 'string' && COST_AFFECTING_MUTATION_KEYS.has(key)) {
    const vars = mut.state.variables as { tripId?: string } | undefined;
    if (vars?.tripId) invalidateCostQueries(vars.tripId);
  }

  // Report final mutation errors to Sentry (after all retries exhausted).
  // Paused mutations are not errors — they're queued offline, so we skip those.
  // Expected business-rule / permission / concurrent-edit errors (Postgres P0001
  // etc.) already reach the user as a toast via the hook's onError — they are not
  // bugs and must not create Sentry issues.
  if (mut.state.status === 'error' && mut.state.error && !mut.state.isPaused) {
    if (!erroredMutationsSeen.has(mut)) {
      erroredMutationsSeen.add(mut);
      if (isExpectedMutationError(mut.state.error)) {
        Sentry.addBreadcrumb({
          category: 'mutation',
          level: 'info',
          message: `expected mutation error: ${String(key ?? 'unknown')}`,
          data: { code: (mut.state.error as { code?: unknown }).code },
        });
      } else {
        Sentry.captureException(mut.state.error, {
          tags: { source: 'mutation', mutationKey: String(key ?? 'unknown') },
        });
      }
    }
  }

  if (!mut.state.isPaused) {
    // Mutation resumed or completed — allow a future pause to show a new toast.
    pausedMutationsSeen.delete(mut);
    return;
  }

  if (pausedMutationsSeen.has(mut)) return;
  pausedMutationsSeen.add(mut);

  if (!isPersistedMutationKey(key)) {
    // Non-persisted paused mutations are silently lost on app restart — tell
    // the user their action could not be saved so they can retry manually.
    useToastStore.getState().addToast('warning', i18n.t('common:offline.mutationFailed'));
  }
});
