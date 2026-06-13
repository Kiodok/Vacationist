import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Json } from './database.types';
import type { ExpenseSplit, ExpenseWithSplits, MemberBalance, CreateExpenseInput, UpdateExpenseWithSplitsInput, SettlementReceipt } from '@vacationist/types';

export const EXPENSE_PAGE_SIZE = 30;

export async function getExpenses(
  tripId: string,
  offset = 0,
): Promise<{ items: ExpenseWithSplits[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, expense_splits(*)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .range(offset, offset + EXPENSE_PAGE_SIZE - 1);

  if (error) throw error;
  const items = (data as unknown as ExpenseWithSplits[]) ?? [];
  return { items, hasMore: items.length === EXPENSE_PAGE_SIZE };
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

export async function unarchiveExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.rpc('unarchive_expense', { p_expense_id: expenseId });
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

export async function coverSplit(splitId: string): Promise<void> {
  const { error } = await (supabase.rpc as Function)('cover_split', { p_split_id: splitId });
  if (error) throw error;
}

export async function uncoverSplit(splitId: string): Promise<void> {
  const { error } = await (supabase.rpc as Function)('uncover_split', { p_split_id: splitId });
  if (error) throw error;
}

export async function settleAllForPair(tripId: string, debtor: string, creditor: string): Promise<number> {
  const { data, error } = await (supabase.rpc as Function)('settle_all_for_pair', {
    p_trip_id: tripId,
    p_debtor: debtor,
    p_creditor: creditor,
  });
  if (error) throw error;
  return data as number;
}

export async function settleAllExpenses(tripId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as Function)('settle_all_expenses', {
    p_trip_id: tripId,
  });
  if (error) throw error;
  return data as string;
}

export async function getSettlementReceipts(tripId: string): Promise<SettlementReceipt[]> {
  const { data, error } = await (supabase as unknown as { from: (t: string) => any })
    .from('settlement_receipts')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SettlementReceipt[];
}

export async function getSettlementReceipt(receiptId: string): Promise<SettlementReceipt> {
  const { data, error } = await (supabase as unknown as { from: (t: string) => any })
    .from('settlement_receipts')
    .select('*')
    .eq('id', receiptId)
    .single();

  if (error) throw error;
  return data as SettlementReceipt;
}

export interface ExpenseRealtimeCallbacks {
  onExpenseChange: () => void;
  onSplitChange: (expenseId: string | null) => void;
}

export function subscribeToExpensesRealtime(
  tripId: string,
  callbacks: ExpenseRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return freshChannel(`expenses:${tripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` },
      () => callbacks.onExpenseChange(),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` },
      () => callbacks.onExpenseChange(),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'expense_splits', filter: `trip_id=eq.${tripId}` },
      (payload) => {
        const row = payload.new as { expense_id?: string };
        callbacks.onSplitChange(row.expense_id ?? null);
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'expense_splits', filter: `trip_id=eq.${tripId}` },
      (payload) => {
        const row = payload.new as { expense_id?: string };
        callbacks.onSplitChange(row.expense_id ?? null);
      },
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'expense_splits', filter: `trip_id=eq.${tripId}` },
      (payload) => {
        const row = payload.old as { expense_id?: string };
        callbacks.onSplitChange(row.expense_id ?? null);
      },
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromExpenses(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
