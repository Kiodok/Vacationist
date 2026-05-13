import { supabase } from './client';
import type { Json } from './database.types';
import type { ExpenseSplit, ExpenseWithSplits, MemberBalance, CreateExpenseInput, UpdateExpenseWithSplitsInput } from '@vacationist/types';

export async function getExpenses(tripId: string): Promise<ExpenseWithSplits[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, expense_splits(*)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as ExpenseWithSplits[];
}

export async function createExpense(tripId: string, input: CreateExpenseInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_expense_with_splits', {
    p_trip_id: tripId,
    p_title: input.title,
    p_amount: input.amount,
    p_currency: input.currency,
    p_paid_by: input.paid_by,
    p_related_type: input.related_type ?? 'manual',
    p_related_id: (input.related_id ?? null) as string,
    p_split_method: input.split_method,
    p_splits: input.splits as unknown as Json,
  });

  if (error) throw error;
  return data as string;
}

export async function updateExpenseWithSplits(expenseId: string, input: UpdateExpenseWithSplitsInput): Promise<void> {
  const { error } = await supabase.rpc('update_expense_with_splits', {
    p_expense_id: expenseId,
    p_title: input.title,
    p_amount: input.amount,
    p_paid_by: input.paid_by,
    p_split_method: input.split_method,
    p_splits: input.splits as unknown as Json,
  });

  if (error) throw error;
}

export async function archiveExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_expense', { p_expense_id: expenseId });
  if (error) throw error;
}

export async function getExpenseSplits(expenseId: string): Promise<ExpenseSplit[]> {
  const { data, error } = await supabase
    .from('expense_splits')
    .select('*')
    .eq('expense_id', expenseId);

  if (error) throw error;
  return data as unknown as ExpenseSplit[];
}

export async function getTripBalances(tripId: string): Promise<MemberBalance[]> {
  const { data, error } = await supabase.rpc('get_trip_balances', { p_trip_id: tripId });
  if (error) throw error;
  return (data as unknown as MemberBalance[]).map((b) => ({
    ...b,
    total_paid: Number(b.total_paid),
    total_owed: Number(b.total_owed),
    net_balance: Number(b.net_balance),
  }));
}

export async function settleExpenseSplit(splitId: string): Promise<void> {
  const { error } = await supabase.rpc('settle_expense_split', { p_split_id: splitId });
  if (error) throw error;
}

export async function unsettleExpenseSplit(splitId: string): Promise<void> {
  const { error } = await supabase.rpc('unsettle_expense_split', { p_split_id: splitId });
  if (error) throw error;
}
