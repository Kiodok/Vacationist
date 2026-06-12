import { QueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { useToastStore } from '../stores/toastStore';
import { i18n } from '@vacationist/i18n';

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
  // Notifications
  'markNotificationRead',
  'markAllNotificationsRead',
  'deleteNotification',
] as const;

export function isPersistedMutationKey(key: unknown): boolean {
  return (PERSISTED_MUTATION_KEYS as readonly unknown[]).includes(key);
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
      gcTime: 24 * 60 * 60 * 1000,      // 24 h — matches PersistQueryClientProvider.maxAge
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

  // Report final mutation errors to Sentry (after all retries exhausted).
  // Paused mutations are not errors — they're queued offline, so we skip those.
  if (mut.state.status === 'error' && mut.state.error && !mut.state.isPaused) {
    if (!erroredMutationsSeen.has(mut)) {
      erroredMutationsSeen.add(mut);
      Sentry.captureException(mut.state.error, {
        tags: { source: 'mutation', mutationKey: String(key ?? 'unknown') },
      });
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
