import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
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
import { useToastStore } from '../../../stores/toastStore';

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'expenses'],
    queryFn: () => getExpenses(tripId),
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
      addToast('success', 'Expense added');
    },
    onError: () => {
      addToast('error', 'Failed to add expense.');
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
      addToast('success', 'Expense updated');
    },
    onError: () => {
      addToast('error', 'Failed to update expense.');
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
      addToast('success', 'Expense archived');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to archive expense.');
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
      addToast('success', 'Expense restored');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to restore expense.');
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
      addToast('success', 'Marked as settled');
    },
    onError: () => {
      addToast('error', 'Failed to settle split.');
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
      addToast('success', 'Marked as open');
    },
    onError: () => {
      addToast('error', 'Failed to reopen split.');
    },
  });
}
