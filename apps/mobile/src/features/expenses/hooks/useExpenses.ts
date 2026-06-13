import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  EXPENSE_PAGE_SIZE,
  getExpenses,
  createExpense,
  updateExpenseWithSplits,
  archiveExpense,
  unarchiveExpense,
  getExpenseSplits,
  getTripBalances,
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

export function useTripBalances(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'balances'],
    queryFn: () => getTripBalances(tripId),
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
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['createExpense'],
    mutationFn: ({ tripId, input }: CreateExpenseVariables) => createExpense(tripId, input),
    onError: () => {
      addToast('error', i18n.t('expenses:toast.addFailed'));
    },
  });
}

export function useUpdateExpenseWithSplits() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['updateExpenseWithSplits'],
    mutationFn: ({ expenseId, input }: UpdateExpenseWithSplitsVariables) =>
      updateExpenseWithSplits(expenseId, input),
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
