import { queryClient } from './queryClient';
import {
  createActivity,
  updateActivity,
  softDeleteActivity,
  closeActivityVoting,
  reopenActivityVoting,
  createNote,
  updateNote,
  deleteNote,
  castActivityVote,
  castAccommodationVote,
  castTransferFlightVote,
  createExpense,
  updateExpenseWithSplits,
  archiveExpense,
  unarchiveExpense,
  settleExpenseSplit,
  unsettleExpenseSplit,
  coverSplit,
  uncoverSplit,
  settleAllForPair,
  createShoppingList,
  updateShoppingList,
  archiveShoppingList,
  unarchiveShoppingList,
  deleteShoppingList,
  createShoppingItem,
  updateShoppingItem,
  softDeleteShoppingItem,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createPackingItem,
  updatePackingItem,
  softDeletePackingItem,
  createSharedPackingItem,
  updateSharedPackingItem,
  claimSharedPackingItem,
  unclaimSharedPackingItem,
  softDeleteSharedPackingItem,
  createLostFoundCase,
  updateLostFoundCase,
  resolveLostFoundCase,
  unresolveLostFoundCase,
  deleteLostFoundCase,
  createAccommodation,
  updateAccommodation,
  softDeleteAccommodation,
  closeAccommodationVoting,
  reopenAccommodationVoting,
  updateTrip,
  createTransferFlight,
  updateTransferFlight,
  softDeleteTransferFlight,
  closeTransferFlightVoting,
  reopenTransferFlightVoting,
  bookTransferFlight,
  createTransferVehicle,
  updateTransferVehicle,
  softDeleteTransferVehicle,
  createTransferRental,
  updateTransferRental,
  softDeleteTransferRental,
} from '@vacationist/api';
import type {
  Activity,
  TripNote,
  UpdateActivityVariables,
  DeleteActivityVariables,
  CloseActivityVotingVariables,
  ReopenActivityVotingVariables,
  CreateTripNoteVariables,
  UpdateTripNoteVariables,
  DeleteTripNoteVariables,
  ToggleTripNoteDoneVariables,
  ActivityVote,
  AccommodationVote,
  TransferFlightVote,
  ShoppingList,
  ShoppingItem,
  CreateActivityVariables,
  CastActivityVoteVariables,
  CastAccommodationVoteVariables,
  CastTransferFlightVoteVariables,
  CreateExpenseVariables,
  UpdateExpenseWithSplitsVariables,
  ArchiveExpenseVariables,
  UnarchiveExpenseVariables,
  SettleExpenseSplitVariables,
  UnsettleExpenseSplitVariables,
  CoverSplitVariables,
  UncoverSplitVariables,
  SettleAllForPairVariables,
  CreateShoppingListVariables,
  UpdateShoppingListVariables,
  ArchiveShoppingListVariables,
  UnarchiveShoppingListVariables,
  DeleteShoppingListVariables,
  CreateShoppingItemVariables,
  UpdateShoppingItemVariables,
  UpdateShoppingItemGlobalVariables,
  DeleteShoppingItemVariables,
  MarkNotificationReadVariables,
  MarkAllNotificationsReadVariables,
  DeleteNotificationVariables,
  PackingItem,
  SharedPackingItem,
  LostFoundCase,
  CreatePackingItemVariables,
  UpdatePackingItemVariables,
  DeletePackingItemVariables,
  CreateSharedPackingItemVariables,
  UpdateSharedPackingItemVariables,
  ClaimSharedPackingItemVariables,
  UnclaimSharedPackingItemVariables,
  DeleteSharedPackingItemVariables,
  CreateLostFoundCaseVariables,
  UpdateLostFoundCaseVariables,
  ResolveLostFoundCaseVariables,
  UnresolveLostFoundCaseVariables,
  DeleteLostFoundCaseVariables,
  Accommodation,
  Trip,
  CreateAccommodationVariables,
  UpdateAccommodationVariables,
  DeleteAccommodationVariables,
  BookAccommodationVariables,
  UnbookAccommodationVariables,
  CloseAccommodationVotingVariables,
  ReopenAccommodationVotingVariables,
  UpdateTripVariables,
  TransferFlight,
  TransferVehicle,
  TransferRental,
  CreateTransferFlightVariables,
  UpdateTransferFlightVariables,
  DeleteTransferFlightVariables,
  CloseTransferFlightVotingVariables,
  ReopenTransferFlightVotingVariables,
  BookTransferFlightVariables,
  CreateTransferVehicleVariables,
  UpdateTransferVehicleVariables,
  DeleteTransferVehicleVariables,
  CreateTransferRentalVariables,
  UpdateTransferRentalVariables,
  DeleteTransferRentalVariables,
} from '@vacationist/types';
import { useToastStore } from '../stores/toastStore';
import { i18n } from '@vacationist/i18n';
import { addSentryBreadcrumb } from './sentry';

// These defaults serve two purposes:
//   1. Provide the mutationFn that TanStack Query uses when replaying persisted
//      (paused) mutations after an app restart — the hook's inline mutationFn is
//      not available after a cold start.
//   2. Centralise onSuccess so that both active AND resumed mutations trigger
//      cache invalidation and the success toast.
//
// Hooks keep their onMutate (optimistic update) and onError (rollback) because
// those require the React context that resumed mutations do not have.

// ─── Activities ──────────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createActivity'], {
  mutationFn: ({ tripId, input }: CreateActivityVariables) => createActivity(tripId, input),
  onSuccess: (_data: Activity, { tripId }: CreateActivityVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    addSentryBreadcrumb('activity', 'Activity created', { tripId });
    useToastStore.getState().addToast('success', i18n.t('activities:toast.created'));
  },
});

queryClient.setMutationDefaults(['updateActivity'], {
  mutationFn: ({ activityId, input }: UpdateActivityVariables) => updateActivity(activityId, input),
  onSuccess: (_data: Activity, { activityId, tripId }: UpdateActivityVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['global-calendar-activities'] });
    queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
    useToastStore.getState().addToast('success', i18n.t('activities:toast.updated'));
  },
});

queryClient.setMutationDefaults(['deleteActivity'], {
  mutationFn: ({ activityId }: DeleteActivityVariables) => softDeleteActivity(activityId),
  onSuccess: (_data: void, { tripId }: DeleteActivityVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    useToastStore.getState().addToast('success', i18n.t('activities:toast.deleted'));
  },
});

queryClient.setMutationDefaults(['closeActivityVoting'], {
  mutationFn: ({ activityId }: CloseActivityVotingVariables) => closeActivityVoting(activityId),
  onSuccess: (_data: void, { activityId, tripId }: CloseActivityVotingVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
    useToastStore.getState().addToast('success', i18n.t('activities:toast.votingClosed'));
  },
});

queryClient.setMutationDefaults(['reopenActivityVoting'], {
  mutationFn: ({ activityId }: ReopenActivityVotingVariables) => reopenActivityVoting(activityId),
  onSuccess: (_data: void, { activityId, tripId }: ReopenActivityVotingVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
    useToastStore.getState().addToast('success', i18n.t('activities:toast.votingReopened'));
  },
});

queryClient.setMutationDefaults(['castActivityVote'], {
  mutationFn: ({ vote, activityId }: CastActivityVoteVariables) => castActivityVote(activityId, vote),
  onSuccess: (_data: ActivityVote, { activityId, tripId }: CastActivityVoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    addSentryBreadcrumb('vote', 'Activity vote cast', { tripId });
  },
});

queryClient.setMutationDefaults(['castAccommodationVote'], {
  mutationFn: ({ vote, accommodationId }: CastAccommodationVoteVariables) =>
    castAccommodationVote(accommodationId, vote),
  onSuccess: (_data: AccommodationVote, { accommodationId, tripId }: CastAccommodationVoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    addSentryBreadcrumb('vote', 'Accommodation vote cast', { tripId });
  },
});

queryClient.setMutationDefaults(['castTransferFlightVote'], {
  mutationFn: ({ vote, flightId }: CastTransferFlightVoteVariables) =>
    castTransferFlightVote(flightId, vote),
  onSuccess: (_data: TransferFlightVote, { flightId, tripId }: CastTransferFlightVoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId, 'votes'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
  },
});

// ─── Expenses ────────────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createExpense'], {
  mutationFn: ({ tripId, input }: CreateExpenseVariables) => createExpense(tripId, input),
  onSuccess: (_data: string, { tripId }: CreateExpenseVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    useToastStore.getState().addToast('success', i18n.t('expenses:toast.added'));
    addSentryBreadcrumb('expense', 'Expense created', { tripId });
  },
});

queryClient.setMutationDefaults(['updateExpenseWithSplits'], {
  mutationFn: ({ expenseId, input }: UpdateExpenseWithSplitsVariables) =>
    updateExpenseWithSplits(expenseId, input),
  onSuccess: (_data: void, { expenseId, tripId }: UpdateExpenseWithSplitsVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'splits'] });
    useToastStore.getState().addToast('success', i18n.t('expenses:toast.updated'));
  },
});

queryClient.setMutationDefaults(['archiveExpense'], {
  mutationFn: ({ expenseId }: ArchiveExpenseVariables) => archiveExpense(expenseId),
  onSuccess: (_data: void, { tripId }: ArchiveExpenseVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    useToastStore.getState().addToast('success', i18n.t('expenses:toast.archived'));
  },
});

queryClient.setMutationDefaults(['unarchiveExpense'], {
  mutationFn: ({ expenseId }: UnarchiveExpenseVariables) => unarchiveExpense(expenseId),
  onSuccess: (_data: void, { tripId }: UnarchiveExpenseVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    useToastStore.getState().addToast('success', i18n.t('expenses:toast.restored'));
  },
});

queryClient.setMutationDefaults(['settleExpenseSplit'], {
  mutationFn: ({ splitId }: SettleExpenseSplitVariables) => settleExpenseSplit(splitId),
  onSuccess: (_data: void, { expenseId, tripId }: SettleExpenseSplitVariables) => {
    queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'splits'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    useToastStore.getState().addToast('success', i18n.t('expenses:toast.settled'));
  },
});

queryClient.setMutationDefaults(['unsettleExpenseSplit'], {
  mutationFn: ({ splitId }: UnsettleExpenseSplitVariables) => unsettleExpenseSplit(splitId),
  onSuccess: (_data: void, { expenseId, tripId }: UnsettleExpenseSplitVariables) => {
    queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'splits'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    useToastStore.getState().addToast('success', i18n.t('expenses:toast.reopened'));
  },
});

queryClient.setMutationDefaults(['coverSplit'], {
  mutationFn: ({ splitId }: CoverSplitVariables) => coverSplit(splitId),
  onSuccess: (_data: void, { expenseId, tripId }: CoverSplitVariables) => {
    queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'splits'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    useToastStore.getState().addToast('success', i18n.t('expenses:toast.covered'));
  },
});

queryClient.setMutationDefaults(['uncoverSplit'], {
  mutationFn: ({ splitId }: UncoverSplitVariables) => uncoverSplit(splitId),
  onSuccess: (_data: void, { expenseId, tripId }: UncoverSplitVariables) => {
    queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'splits'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    useToastStore.getState().addToast('success', i18n.t('expenses:toast.uncovered'));
  },
});

queryClient.setMutationDefaults(['settleAllForPair'], {
  mutationFn: ({ tripId, debtor, creditor }: SettleAllForPairVariables) =>
    settleAllForPair(tripId, debtor, creditor),
  onSuccess: (_data: number, { tripId }: SettleAllForPairVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    useToastStore.getState().addToast('success', i18n.t('expenses:toast.settleAllDone'));
  },
});

// ─── Shopping lists ───────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createShoppingList'], {
  mutationFn: ({ tripId, input }: CreateShoppingListVariables) => createShoppingList(tripId, input),
  onSuccess: (_data: ShoppingList, { tripId }: CreateShoppingListVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    useToastStore.getState().addToast('success', i18n.t('shopping:toast.listCreated'));
  },
});

queryClient.setMutationDefaults(['updateShoppingList'], {
  mutationFn: ({ listId, input }: UpdateShoppingListVariables) => updateShoppingList(listId, input),
  onSuccess: (_data: ShoppingList, { tripId }: UpdateShoppingListVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    useToastStore.getState().addToast('success', i18n.t('shopping:toast.listUpdated'));
  },
});

queryClient.setMutationDefaults(['archiveShoppingList'], {
  mutationFn: ({ listId }: ArchiveShoppingListVariables) => archiveShoppingList(listId),
  onSuccess: (_data: void, { tripId }: ArchiveShoppingListVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    useToastStore.getState().addToast('success', i18n.t('shopping:toast.listArchived'));
  },
});

queryClient.setMutationDefaults(['unarchiveShoppingList'], {
  mutationFn: ({ listId }: UnarchiveShoppingListVariables) => unarchiveShoppingList(listId),
  onSuccess: (_data: void, { tripId }: UnarchiveShoppingListVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    useToastStore.getState().addToast('success', i18n.t('shopping:toast.listRestored'));
  },
});

queryClient.setMutationDefaults(['deleteShoppingList'], {
  mutationFn: ({ listId }: DeleteShoppingListVariables) => deleteShoppingList(listId),
  onSuccess: (_data: void, { tripId }: DeleteShoppingListVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    useToastStore.getState().addToast('success', i18n.t('shopping:toast.listDeleted'));
  },
});

// ─── Shopping items ───────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createShoppingItem'], {
  mutationFn: ({ listId, input }: CreateShoppingItemVariables) => createShoppingItem(listId, input),
  onSuccess: (newItem: ShoppingItem, { listId, tripId }: CreateShoppingItemVariables) => {
    queryClient.setQueryData<ShoppingItem[]>(
      ['shopping-lists', listId, 'items'],
      (old) => {
        if (!old) return [newItem];
        if (old.some((i) => i.id === newItem.id)) return old;
        return [...old, newItem];
      },
    );
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
  },
});

queryClient.setMutationDefaults(['updateShoppingItem'], {
  mutationFn: ({ itemId, input }: UpdateShoppingItemVariables) => updateShoppingItem(itemId, input),
  onSuccess: (_data: ShoppingItem, { listId, tripId }: UpdateShoppingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['shopping-lists', listId, 'items'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
  },
});

queryClient.setMutationDefaults(['updateShoppingItemGlobal'], {
  mutationFn: ({ itemId, input }: UpdateShoppingItemGlobalVariables) => updateShoppingItem(itemId, input),
  onSuccess: (_data: ShoppingItem, { tripId }: UpdateShoppingItemGlobalVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'all-shopping-items'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
  },
});

queryClient.setMutationDefaults(['deleteShoppingItem'], {
  mutationFn: ({ itemId }: DeleteShoppingItemVariables) => softDeleteShoppingItem(itemId),
  onSuccess: (_data: void, { listId, tripId }: DeleteShoppingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['shopping-lists', listId, 'items'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    useToastStore.getState().addToast('success', i18n.t('shopping:toast.itemRemoved'));
  },
});

// ─── Trips ───────────────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['updateTrip'], {
  mutationFn: ({ tripId, input }: UpdateTripVariables) => updateTrip(tripId, input),
  onSuccess: (_data: Trip, { tripId }: UpdateTripVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
    useToastStore.getState().addToast('success', i18n.t('trips:toast.updated'));
  },
});

// ─── Accommodations ──────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createAccommodation'], {
  mutationFn: ({ tripId, input }: CreateAccommodationVariables) => createAccommodation(tripId, input),
  onSuccess: (_data: Accommodation, { tripId }: CreateAccommodationVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    useToastStore.getState().addToast('success', i18n.t('accommodations:toast.added'));
  },
});

queryClient.setMutationDefaults(['updateAccommodation'], {
  mutationFn: ({ accommodationId, input }: UpdateAccommodationVariables) =>
    updateAccommodation(accommodationId, input),
  onSuccess: (_data: Accommodation, { accommodationId, tripId }: UpdateAccommodationVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId] });
    useToastStore.getState().addToast('success', i18n.t('accommodations:toast.updated'));
  },
});

queryClient.setMutationDefaults(['deleteAccommodation'], {
  mutationFn: ({ accommodationId }: DeleteAccommodationVariables) =>
    softDeleteAccommodation(accommodationId),
  onSuccess: (_data: void, { tripId }: DeleteAccommodationVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    useToastStore.getState().addToast('success', i18n.t('accommodations:toast.removed'));
  },
});

queryClient.setMutationDefaults(['bookAccommodation'], {
  mutationFn: ({ accommodationId }: BookAccommodationVariables) =>
    updateAccommodation(accommodationId, { status: 'booked' }),
  onSuccess: (_data: Accommodation, { accommodationId, tripId }: BookAccommodationVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId] });
    useToastStore.getState().addToast('success', i18n.t('accommodations:toast.booked'));
  },
});

queryClient.setMutationDefaults(['unbookAccommodation'], {
  mutationFn: ({ accommodationId }: UnbookAccommodationVariables) =>
    updateAccommodation(accommodationId, { status: 'suggested' }),
  onSuccess: (_data: Accommodation, { accommodationId, tripId }: UnbookAccommodationVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId] });
    useToastStore.getState().addToast('success', i18n.t('accommodations:toast.unbooked'));
  },
});

queryClient.setMutationDefaults(['closeAccommodationVoting'], {
  mutationFn: ({ accommodationId }: CloseAccommodationVotingVariables) =>
    closeAccommodationVoting(accommodationId),
  onSuccess: (_data: void, { accommodationId, tripId }: CloseAccommodationVotingVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
    useToastStore.getState().addToast('success', i18n.t('accommodations:toast.votingClosed'));
  },
});

queryClient.setMutationDefaults(['reopenAccommodationVoting'], {
  mutationFn: ({ accommodationId }: ReopenAccommodationVotingVariables) =>
    reopenAccommodationVoting(accommodationId),
  onSuccess: (_data: void, { accommodationId, tripId }: ReopenAccommodationVotingVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
    useToastStore.getState().addToast('success', i18n.t('accommodations:toast.votingReopened'));
  },
});

// ─── Transfer flights ────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createTransferFlight'], {
  mutationFn: ({ tripId, input }: CreateTransferFlightVariables) => createTransferFlight(tripId, input),
  onSuccess: (_data: TransferFlight, { tripId }: CreateTransferFlightVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.flightAdded'));
  },
});

queryClient.setMutationDefaults(['updateTransferFlight'], {
  mutationFn: ({ flightId, input }: UpdateTransferFlightVariables) => updateTransferFlight(flightId, input),
  onSuccess: (_data: TransferFlight, { flightId, tripId }: UpdateTransferFlightVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.flightUpdated'));
  },
});

queryClient.setMutationDefaults(['deleteTransferFlight'], {
  mutationFn: ({ flightId }: DeleteTransferFlightVariables) => softDeleteTransferFlight(flightId),
  onSuccess: (_data: void, { tripId }: DeleteTransferFlightVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.flightRemoved'));
  },
});

queryClient.setMutationDefaults(['closeTransferFlightVoting'], {
  mutationFn: ({ flightId }: CloseTransferFlightVotingVariables) => closeTransferFlightVoting(flightId),
  onSuccess: (_data: void, { flightId, tripId }: CloseTransferFlightVotingVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId, 'votes'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.votingClosed'));
  },
});

queryClient.setMutationDefaults(['reopenTransferFlightVoting'], {
  mutationFn: ({ flightId }: ReopenTransferFlightVotingVariables) => reopenTransferFlightVoting(flightId),
  onSuccess: (_data: void, { flightId, tripId }: ReopenTransferFlightVotingVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId, 'votes'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.votingReopened'));
  },
});

queryClient.setMutationDefaults(['bookTransferFlight'], {
  mutationFn: ({ flightId, input }: BookTransferFlightVariables) => bookTransferFlight(flightId, input),
  onSuccess: (_data: void, { tripId }: BookTransferFlightVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.flightBooked'));
  },
});

// ─── Transfer vehicles ───────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createTransferVehicle'], {
  mutationFn: ({ tripId, input }: CreateTransferVehicleVariables) => createTransferVehicle(tripId, input),
  onSuccess: (_data: TransferVehicle, { tripId }: CreateTransferVehicleVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.vehicleAdded'));
  },
});

queryClient.setMutationDefaults(['updateTransferVehicle'], {
  mutationFn: ({ vehicleId, input }: UpdateTransferVehicleVariables) => updateTransferVehicle(vehicleId, input),
  onSuccess: (_data: TransferVehicle, { tripId }: UpdateTransferVehicleVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.vehicleUpdated'));
  },
});

queryClient.setMutationDefaults(['deleteTransferVehicle'], {
  mutationFn: ({ vehicleId }: DeleteTransferVehicleVariables) => softDeleteTransferVehicle(vehicleId),
  onSuccess: (_data: void, { tripId }: DeleteTransferVehicleVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.vehicleRemoved'));
  },
});

// ─── Transfer rentals ────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createTransferRental'], {
  mutationFn: ({ tripId, input }: CreateTransferRentalVariables) => createTransferRental(tripId, input),
  onSuccess: (_data: TransferRental, { tripId }: CreateTransferRentalVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-rentals'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.rentalAdded'));
  },
});

queryClient.setMutationDefaults(['updateTransferRental'], {
  mutationFn: ({ rentalId, input }: UpdateTransferRentalVariables) => updateTransferRental(rentalId, input),
  onSuccess: (_data: TransferRental, { tripId }: UpdateTransferRentalVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-rentals'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.rentalUpdated'));
  },
});

queryClient.setMutationDefaults(['deleteTransferRental'], {
  mutationFn: ({ rentalId }: DeleteTransferRentalVariables) => softDeleteTransferRental(rentalId),
  onSuccess: (_data: void, { tripId }: DeleteTransferRentalVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-rentals'] });
    useToastStore.getState().addToast('success', i18n.t('transfer:toast.rentalRemoved'));
  },
});

// ─── Private packing items ───────────────────────────────────────────────────

queryClient.setMutationDefaults(['createPackingItem'], {
  mutationFn: ({ tripId, input }: CreatePackingItemVariables) => createPackingItem(tripId, input),
  onSuccess: (_data: PackingItem, { tripId }: CreatePackingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'packing-items'] });
  },
});

queryClient.setMutationDefaults(['updatePackingItem'], {
  mutationFn: ({ itemId, input }: UpdatePackingItemVariables) => updatePackingItem(itemId, input),
  onSuccess: (_data: PackingItem, { tripId }: UpdatePackingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'packing-items'] });
  },
});

queryClient.setMutationDefaults(['deletePackingItem'], {
  mutationFn: ({ itemId }: DeletePackingItemVariables) => softDeletePackingItem(itemId),
  onSuccess: (_data: void, { tripId }: DeletePackingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'packing-items'] });
  },
});

// ─── Shared packing items ────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createSharedPackingItem'], {
  mutationFn: ({ tripId, input }: CreateSharedPackingItemVariables) => createSharedPackingItem(tripId, input),
  onSuccess: (_data: SharedPackingItem, { tripId }: CreateSharedPackingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'packing-items'] });
  },
});

queryClient.setMutationDefaults(['updateSharedPackingItem'], {
  mutationFn: ({ itemId, input }: UpdateSharedPackingItemVariables) => updateSharedPackingItem(itemId, input),
  onSuccess: (_data: SharedPackingItem, { tripId }: UpdateSharedPackingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
  },
});

queryClient.setMutationDefaults(['claimSharedPackingItem'], {
  mutationFn: ({ itemId }: ClaimSharedPackingItemVariables) => claimSharedPackingItem(itemId),
  onSuccess: (_data: void, { tripId }: ClaimSharedPackingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'packing-items'] });
    useToastStore.getState().addToast('success', i18n.t('stuff:toast.claimed'));
  },
});

queryClient.setMutationDefaults(['unclaimSharedPackingItem'], {
  mutationFn: ({ itemId }: UnclaimSharedPackingItemVariables) => unclaimSharedPackingItem(itemId),
  onSuccess: (_data: void, { tripId }: UnclaimSharedPackingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
    useToastStore.getState().addToast('success', i18n.t('stuff:toast.unclaimed'));
  },
});

queryClient.setMutationDefaults(['deleteSharedPackingItem'], {
  mutationFn: ({ itemId }: DeleteSharedPackingItemVariables) => softDeleteSharedPackingItem(itemId),
  onSuccess: (_data: void, { tripId }: DeleteSharedPackingItemVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
  },
});

// ─── Lost & found cases ──────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createLostFoundCase'], {
  mutationFn: ({ tripId, input }: CreateLostFoundCaseVariables) => createLostFoundCase(tripId, input),
  onSuccess: (_data: LostFoundCase, { tripId }: CreateLostFoundCaseVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'lost-found'] });
    useToastStore.getState().addToast('success', i18n.t('stuff:toast.caseCreated'));
  },
});

queryClient.setMutationDefaults(['updateLostFoundCase'], {
  mutationFn: ({ caseId, input }: UpdateLostFoundCaseVariables) => updateLostFoundCase(caseId, input),
  onSuccess: (_data: LostFoundCase, { tripId }: UpdateLostFoundCaseVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'lost-found'] });
    useToastStore.getState().addToast('success', i18n.t('stuff:toast.caseUpdated'));
  },
});

queryClient.setMutationDefaults(['resolveLostFoundCase'], {
  mutationFn: ({ caseId }: ResolveLostFoundCaseVariables) => resolveLostFoundCase(caseId),
  onSuccess: (_data: void, { tripId }: ResolveLostFoundCaseVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'lost-found'] });
    useToastStore.getState().addToast('success', i18n.t('stuff:toast.caseResolved'));
  },
});

queryClient.setMutationDefaults(['unresolveLostFoundCase'], {
  mutationFn: ({ caseId }: UnresolveLostFoundCaseVariables) => unresolveLostFoundCase(caseId),
  onSuccess: (_data: void, { tripId }: UnresolveLostFoundCaseVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'lost-found'] });
    useToastStore.getState().addToast('success', i18n.t('stuff:toast.caseUnresolved'));
  },
});

queryClient.setMutationDefaults(['deleteLostFoundCase'], {
  mutationFn: ({ caseId }: DeleteLostFoundCaseVariables) => deleteLostFoundCase(caseId),
  onSuccess: (_data: void, { tripId }: DeleteLostFoundCaseVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'lost-found'] });
  },
});

// ─── Trip notes ───────────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['createTripNote'], {
  mutationFn: ({ tripId, input }: CreateTripNoteVariables) => createNote(tripId, input),
  onSuccess: (_data: TripNote, { tripId }: CreateTripNoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notes'] });
    useToastStore.getState().addToast('success', i18n.t('notes:toast.created'));
  },
});

queryClient.setMutationDefaults(['updateTripNote'], {
  mutationFn: ({ noteId, input }: UpdateTripNoteVariables) => updateNote(noteId, input),
  onSuccess: (_data: TripNote, { tripId }: UpdateTripNoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notes'] });
    useToastStore.getState().addToast('success', i18n.t('notes:toast.updated'));
  },
});

queryClient.setMutationDefaults(['deleteTripNote'], {
  mutationFn: ({ noteId }: DeleteTripNoteVariables) => deleteNote(noteId),
  onSuccess: (_data: void, { tripId }: DeleteTripNoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notes'] });
    useToastStore.getState().addToast('success', i18n.t('notes:toast.deleted'));
  },
});

queryClient.setMutationDefaults(['toggleTripNoteDone'], {
  mutationFn: ({ noteId, isDone }: ToggleTripNoteDoneVariables) => updateNote(noteId, { is_done: isDone }),
  onSuccess: (_data: TripNote, { tripId }: ToggleTripNoteDoneVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notes'] });
  },
});

// ─── Notifications ────────────────────────────────────────────────────────────

queryClient.setMutationDefaults(['markNotificationRead'], {
  mutationFn: ({ notificationId }: MarkNotificationReadVariables) => markNotificationRead(notificationId),
  onSuccess: (_data: void, _vars: MarkNotificationReadVariables) => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  },
});

queryClient.setMutationDefaults(['markAllNotificationsRead'], {
  mutationFn: ({ tripId }: MarkAllNotificationsReadVariables) => markAllNotificationsRead(tripId),
  onSuccess: (_data: void, { tripId }: MarkAllNotificationsReadVariables) => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    if (tripId) {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notifications', 'unread-count'] });
    }
  },
});

queryClient.setMutationDefaults(['deleteNotification'], {
  mutationFn: ({ notificationId }: DeleteNotificationVariables) => deleteNotification(notificationId),
  onSuccess: (_data: void, { tripId }: DeleteNotificationVariables) => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    if (tripId) {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notifications', 'unread-count'] });
    }
  },
});
