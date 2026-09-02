import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  EXPENSE_PAGE_SIZE,
  getExpenses,
  getAllExpenses,
  hasBusinessExpenses,
  createExpense,
  updateExpenseWithSplits,
  archiveExpense,
  unarchiveExpense,
  getExpenseSplits,
  getTripBalances,
  getTripExpenseCategoryTotals,
  settleExpenseSplit,
  unsettleExpenseSplit,
  coverSplit,
  uncoverSplit,
  settleAllForPair,
  settleAllExpenses,
  getSettlementReceipts,
  getSettlementReceipt,
} from '@vacationist/api';
import type {
  CreateExpenseVariables,
  UpdateExpenseWithSplitsVariables,
  ArchiveExpenseVariables,
  UnarchiveExpenseVariables,
  SettleExpenseSplitVariables,
  UnsettleExpenseSplitVariables,
  CoverSplitVariables,
  UncoverSplitVariables,
  SettleAllForPairVariables,
  SettleAllExpensesVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useExpenses(tripId: string) {
  return useInfiniteQuery({
    queryKey: ['trips', tripId, 'expenses'],
    queryFn: ({ pageParam }) => getExpenses(tripId, (pageParam as number) ?? 0),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * EXPENSE_PAGE_SIZE : undefined,
    initialPageParam: 0,
    retry: 2,
    enabled: !!tripId,
  });
}

/**
 * Every expense for a trip, not just the paginated feed — used by consumers that are
 * semantically whole-trip (the business-expense summary) so they never silently see only the
 * first page. Nested under the paged key (['trips', tripId, 'expenses', 'all']) so
 * invalidating ['trips', tripId, 'expenses'] refreshes both, same pattern as useAllActivities.
 */
export function useAllExpenses(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['trips', tripId, 'expenses', 'all'],
    queryFn: () => getAllExpenses(tripId),
    retry: 2,
    enabled: !!tripId && enabled,
  });
}

/**
 * Cheap existence check gating the Business Summary button — deliberately a `head: true` count
 * query (see hasBusinessExpenses), not useAllExpenses, so the button's visibility never pays for
 * a whole-trip fetch. Nested under the paged key so any expense mutation invalidation
 * (['trips', tripId, 'expenses']) refreshes it too.
 */
export function useHasBusinessExpenses(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'expenses', 'has-business'],
    queryFn: () => hasBusinessExpenses(tripId),
    staleTime: 60_000,
    retry: 2,
    enabled: !!tripId,
  });
}

export function useTripBalances(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'balances'],
    queryFn: () => getTripBalances(tripId),
    staleTime: 60_000,
    retry: 2,
    enabled: !!tripId,
  });
}

export function useExpenseCategoryTotals(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'expense-category-totals'],
    queryFn: () => getTripExpenseCategoryTotals(tripId),
    staleTime: 60_000,
    retry: 2,
    enabled: !!tripId,
  });
}

export function useExpenseSplits(expenseId: string) {
  return useQuery({
    queryKey: ['expenses', expenseId, 'splits'],
    queryFn: () => getExpenseSplits(expenseId),
    retry: 2,
    enabled: !!expenseId,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['createExpense'],
    mutationFn: ({ tripId, input }: CreateExpenseVariables) => createExpense(tripId, input),
    // Optimistically flips the Business Summary button's gating flag on immediately, rather than
    // waiting on a network round trip (the RPC call) plus a second one (mutationDefaults'
    // post-success invalidate+refetch of has-business) before the button appears. Only ever sets
    // it to `true` here — never `false` on omission, since other business expenses may still
    // exist; the real invalidate+refetch still runs on success and is the source of truth.
    onMutate: ({ tripId, input }: CreateExpenseVariables) => {
      if (input.is_business) {
        queryClient.setQueryData(['trips', tripId, 'expenses', 'has-business'], true);
      }
    },
    onError: () => {
      addToast('error', i18n.t('expenses:toast.addFailed'));
    },
  });
}

export function useUpdateExpenseWithSplits() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['updateExpenseWithSplits'],
    mutationFn: ({ expenseId, input }: UpdateExpenseWithSplitsVariables) =>
      updateExpenseWithSplits(expenseId, input),
    // Same immediate-visibility reasoning as useCreateExpense's onMutate above.
    onMutate: ({ tripId, input }: UpdateExpenseWithSplitsVariables) => {
      if (input.is_business) {
        queryClient.setQueryData(['trips', tripId, 'expenses', 'has-business'], true);
      }
    },
    onError: () => {
      addToast('error', i18n.t('expenses:toast.updateFailed'));
    },
  });
}

export function useArchiveExpense() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['archiveExpense'],
    mutationFn: ({ expenseId }: ArchiveExpenseVariables) => archiveExpense(expenseId),
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('expenses:toast.archiveFailed'));
    },
  });
}

export function useUnarchiveExpense() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['unarchiveExpense'],
    mutationFn: ({ expenseId }: UnarchiveExpenseVariables) => unarchiveExpense(expenseId),
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('expenses:toast.restoreFailed'));
    },
  });
}

export function useSettleExpenseSplit() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['settleExpenseSplit'],
    mutationFn: ({ splitId }: SettleExpenseSplitVariables) => settleExpenseSplit(splitId),
    onError: () => {
      addToast('error', i18n.t('expenses:toast.settleFailed'));
    },
  });
}

export function useUnsettleExpenseSplit() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['unsettleExpenseSplit'],
    mutationFn: ({ splitId }: UnsettleExpenseSplitVariables) => unsettleExpenseSplit(splitId),
    onError: () => {
      addToast('error', i18n.t('expenses:toast.reopenFailed'));
    },
  });
}

export function useCoverSplit() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['coverSplit'],
    mutationFn: ({ splitId }: CoverSplitVariables) => coverSplit(splitId),
    onError: () => {
      addToast('error', i18n.t('expenses:toast.coverFailed'));
    },
  });
}

export function useUncoverSplit() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['uncoverSplit'],
    mutationFn: ({ splitId }: UncoverSplitVariables) => uncoverSplit(splitId),
    onError: () => {
      addToast('error', i18n.t('expenses:toast.uncoverFailed'));
    },
  });
}

export function useSettleAllForPair() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['settleAllForPair'],
    mutationFn: ({ tripId, debtor, creditor }: SettleAllForPairVariables) =>
      settleAllForPair(tripId, debtor, creditor),
    onSuccess: (_, { tripId }) => {
      addToast('success', i18n.t('expenses:toast.settleAllDone'));
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
    },
    onError: () => {
      addToast('error', i18n.t('expenses:toast.settleAllFailed'));
    },
  });
}

export function useSettleAllExpenses() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['settleAllExpenses'],
    mutationFn: ({ tripId }: SettleAllExpensesVariables) => settleAllExpenses(tripId),
    onSuccess: (_, { tripId }) => {
      addToast('success', i18n.t('expenses:toast.settleAllDone'));
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'settlement-receipts'] });
    },
    onError: (error: Error) => {
      const msg = error?.message?.includes('No open splits')
        ? i18n.t('expenses:toast.noOpenSplits')
        : i18n.t('expenses:toast.settleAllFailed');
      addToast('error', msg);
    },
  });
}

export function useSettlementReceipts(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'settlement-receipts'],
    queryFn: () => getSettlementReceipts(tripId),
    staleTime: 60_000,
    retry: 2,
    enabled: !!tripId,
  });
}

export function useSettlementReceipt(receiptId: string) {
  return useQuery({
    queryKey: ['settlement-receipts', receiptId],
    queryFn: () => getSettlementReceipt(receiptId),
    staleTime: Infinity,
    retry: 2,
    enabled: !!receiptId,
  });
}
