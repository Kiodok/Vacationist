import { queryClient } from './queryClient';
import {
  createActivity,
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
} from '@vacationist/api';
import type {
  Activity,
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
} from '@vacationist/types';
import { useToastStore } from '../stores/toastStore';
import { i18n } from '@vacationist/i18n';

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
    useToastStore.getState().addToast('success', i18n.t('activities:toast.created'));
  },
});

queryClient.setMutationDefaults(['castActivityVote'], {
  mutationFn: ({ vote, activityId }: CastActivityVoteVariables) => castActivityVote(activityId, vote),
  onSuccess: (_data: ActivityVote, { activityId, tripId }: CastActivityVoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
  },
});

queryClient.setMutationDefaults(['castAccommodationVote'], {
  mutationFn: ({ vote, accommodationId }: CastAccommodationVoteVariables) =>
    castAccommodationVote(accommodationId, vote),
  onSuccess: (_data: AccommodationVote, { accommodationId, tripId }: CastAccommodationVoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
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
