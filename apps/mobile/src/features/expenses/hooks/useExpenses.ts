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
} from '@vacationist/api';
import type { CreateExpenseInput, UpdateExpenseWithSplitsInput, ExpenseWithSplits } from '@vacationist/types';
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

export function useCreateExpense(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateExpenseInput) => createExpense(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
      addToast('success', i18n.t('expenses:toast.added'));
    },
    onError: () => {
      addToast('error', i18n.t('expenses:toast.addFailed'));
    },
  });
}

export function useUpdateExpenseWithSplits(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ expenseId, input }: { expenseId: string; input: UpdateExpenseWithSplitsInput }) =>
      updateExpenseWithSplits(expenseId, input),
    onSuccess: (_data, { expenseId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
      queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'splits'] });
      addToast('success', i18n.t('expenses:toast.updated'));
    },
    onError: () => {
      addToast('error', i18n.t('expenses:toast.updateFailed'));
    },
  });
}

export function useArchiveExpense(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (expenseId: string) => archiveExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
      addToast('success', i18n.t('expenses:toast.archived'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('expenses:toast.archiveFailed'));
    },
  });
}

export function useUnarchiveExpense(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (expenseId: string) => unarchiveExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
      addToast('success', i18n.t('expenses:toast.restored'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('expenses:toast.restoreFailed'));
    },
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

export function useSettleExpenseSplit(tripId: string, expenseId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (splitId: string) => settleExpenseSplit(splitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'splits'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
      addToast('success', i18n.t('expenses:toast.settled'));
    },
    onError: () => {
      addToast('error', i18n.t('expenses:toast.settleFailed'));
    },
  });
}

export function useUnsettleExpenseSplit(tripId: string, expenseId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (splitId: string) => unsettleExpenseSplit(splitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'splits'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
      addToast('success', i18n.t('expenses:toast.reopened'));
    },
    onError: () => {
      addToast('error', i18n.t('expenses:toast.reopenFailed'));
    },
  });
}
