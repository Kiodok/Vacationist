import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Json } from './database.types';
import type { ExpenseSplit, ExpenseWithSplits, MemberBalance, ExpenseCategoryTotal, CreateExpenseInput, UpdateExpenseWithSplitsInput, SettlementReceipt, BusinessExpensePdfInput } from '@vacationist/types';

export const EXPENSE_PAGE_SIZE = 30;

export async function getExpenses(
  tripId: string,
  offset = 0,
): Promise<{ items: ExpenseWithSplits[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, payer:users!paid_by(id, name, avatar_url), expense_splits(*, split_user:users!user_id(id, name, avatar_url))')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .range(offset, offset + EXPENSE_PAGE_SIZE - 1);

  if (error) throw error;
  const items = (data as unknown as ExpenseWithSplits[]) ?? [];
  return { items, hasMore: items.length === EXPENSE_PAGE_SIZE };
}

const ALL_EXPENSES_BATCH_SIZE = 500;
// Hard ceiling on internal batches, purely a runaway guard — same pattern as
// getAllActivities (packages/api/src/activities.ts). Whole-trip consumers (the business-expense
// summary) must never silently see a truncated list; the paged expenses-tab feed (getExpenses
// above) is a separate, smaller fetch.
const ALL_EXPENSES_MAX_BATCHES = 20;

/** Every expense for a trip (including archived — a business summary needs the full picture), fetched via internal batching so no row is silently dropped. */
export async function getAllExpenses(tripId: string): Promise<ExpenseWithSplits[]> {
  const all: ExpenseWithSplits[] = [];
  for (let i = 0; i < ALL_EXPENSES_MAX_BATCHES; i++) {
    const offset = i * ALL_EXPENSES_BATCH_SIZE;
    const { data, error } = await supabase
      .from('expenses')
      .select('*, payer:users!paid_by(id, name, avatar_url), expense_splits(*, split_user:users!user_id(id, name, avatar_url))')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .range(offset, offset + ALL_EXPENSES_BATCH_SIZE - 1);

    if (error) throw error;
    const batch = (data as unknown as ExpenseWithSplits[]) ?? [];
    all.push(...batch);
    if (batch.length < ALL_EXPENSES_BATCH_SIZE) break;
  }
  return all;
}

/** Cheap existence check ("does this trip have at least one business-flagged cost, from ANY
 * source — expenses, Base, or a priced Transfer type?") used to gate the Business Summary
 * button. Five `head: true` count queries (one per source table), not a row fetch, so this
 * stays lightweight regardless of trip size; run in parallel and short-circuited by Promise.all
 * only in the sense that all five always run — there's no cheaper single-query way to OR across
 * unrelated tables in PostgREST. transfer_vehicles is excluded — it has no is_business column
 * (no price to flag as business, per item 9). */
export async function hasBusinessCosts(tripId: string): Promise<boolean> {
  // transfer_flights/transfer_rentals/transfer_public_transport had `deleted_at IS NULL` removed
  // from their SELECT RLS (20260522000008_transfer_realtime_softdelete_rls.sql, for realtime
  // soft-delete propagation) — every explicit query against them must filter it back in itself, or
  // a soft-deleted business-flagged row keeps this check (and the Business Summary button) true
  // even though the actual export correctly excludes it. `accommodations`/`expenses` don't need
  // this — their RLS still filters `deleted_at` server-side.
  const tables = ['expenses', 'accommodations', 'transfer_flights', 'transfer_rentals', 'transfer_public_transport'] as const;
  const softDeletableInQuery = new Set(['transfer_flights', 'transfer_rentals', 'transfer_public_transport']);
  const counts = await Promise.all(
    tables.map(async (table) => {
      let query = supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .eq('is_business', true);
      if (softDeletableInQuery.has(table)) {
        query = query.is('deleted_at', null);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    }),
  );
  return counts.some((c) => c > 0);
}

/** Calls the render-business-expense-pdf Edge Function and returns the PDF as a base64 string.
 * The access token is attached explicitly (same reasoning as reportSignUpAttribution — don't
 * rely on functions.invoke's implicit auth injection). Throws on failure; the caller falls back
 * to delivering just the Markdown. */
export async function renderBusinessExpensePdf(input: BusinessExpensePdfInput): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session — cannot render business expense PDF');
  const { data, error } = await supabase.functions.invoke<{ pdfBase64: string }>('render-business-expense-pdf', {
    body: input,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
  if (!data?.pdfBase64) throw new Error('Edge function returned no PDF');
  return data.pdfBase64;
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
    // '' clears/omits the description; the RPC stores '' as NULL.
    p_description: input.description ?? '',
    p_is_business: input.is_business ?? false,
  } as never);

  if (error) throw error;
  return data as string;
}

export async function updateExpenseWithSplits(expenseId: string, input: UpdateExpenseWithSplitsInput): Promise<void> {
  const { error } = await (supabase.rpc as Function)('update_expense_with_splits', {
    p_expense_id: expenseId,
    p_title: input.title,
    p_amount: input.amount,
    p_currency: input.currency,
    p_paid_by: input.paid_by,
    p_split_method: input.split_method,
    p_splits: input.splits as unknown as Json,
    p_related_type: input.related_type ?? null,
    // '' clears the description; the RPC only treats NULL (never sent by this app) as "keep existing".
    p_description: input.description ?? '',
    // NULL = keep existing (RPC does COALESCE(p_is_business, is_business)), same sentinel
    // convention as p_related_type above — unlike createExpense's `?? false` (a brand-new
    // expense with no explicit flag should genuinely default false, not "keep existing").
    p_is_business: input.is_business ?? null,
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

export async function getTripExpenseCategoryTotals(tripId: string): Promise<ExpenseCategoryTotal[]> {
  const { data, error } = await supabase.rpc('get_trip_expense_category_totals', { p_trip_id: tripId });
  if (error) throw error;
  return (data as unknown as ExpenseCategoryTotal[]).map((c) => ({ ...c, total: Number(c.total) }));
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
