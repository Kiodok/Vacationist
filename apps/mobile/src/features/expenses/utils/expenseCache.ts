import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import type { CreateExpenseInput, ExpenseWithSplits, ExchangeRate, Trip } from '@vacationist/types';
import { convertAmount } from '@vacationist/utils';
import { isOptimisticId } from '../../../utils/optimisticId';

/**
 * Optimistic cache patches for creating an expense — shared by `useCreateExpense.onMutate` (live
 * taps) and the cold-start rehydrator (`utils/optimisticRehydrate.ts`).
 *
 * Before v1.39.0 an expense created offline inserted nothing into the list: it only appeared once
 * the queued RPC replayed, so an offline user saw their expense "vanish" after saving it. This adds
 * a placeholder row to both caches the UI reads:
 *   - `['trips', tripId, 'expenses']`        — the paginated feed (`InfiniteData<{items, hasMore}>`)
 *   - `['trips', tripId, 'expenses', 'all']` — the whole-trip list (`ExpenseWithSplits[]`)
 *
 * The placeholder has NO splits: computing per-member amounts for even/exact/shares offline would
 * duplicate the server's rounding rules, and the card shows no settlement badge for an expense with
 * no splits. It is replaced by the real row when the replay's invalidation refetches.
 */

interface ExpensePage {
  items: ExpenseWithSplits[];
  hasMore: boolean;
}

const feedKey = (tripId: string) => ['trips', tripId, 'expenses'] as const;
const allKey = (tripId: string) => ['trips', tripId, 'expenses', 'all'] as const;

export interface OptimisticExpenseParams {
  optimisticId: string;
  tripId: string;
  input: CreateExpenseInput;
  createdBy: string;
}

/**
 * `exchange_rate` / `converted_amount` from the cached FX rates, mirroring the RPC
 * (`exchange_rate = rate[base] / rate[currency]`, `converted = round(amount * exchange_rate)`). When
 * the base currency or a rate isn't cached the row falls back to 1:1 rather than showing nothing —
 * it's a placeholder; the server freezes the real figures on replay.
 */
export function resolveOptimisticFx(
  qc: QueryClient,
  tripId: string,
  currency: string,
  amount: number,
): { exchange_rate: number; converted_amount: number } {
  const base = qc.getQueryData<Trip>(['trips', tripId])?.base_currency;
  if (!base || base === currency) return { exchange_rate: 1, converted_amount: amount };
  const rates = qc.getQueryData<ExchangeRate[]>(['exchangeRates']) ?? [];
  const rateBase = rates.find((r) => r.currency === base)?.rate;
  const rateCurrency = rates.find((r) => r.currency === currency)?.rate;
  if (rateBase == null || rateCurrency == null || rateBase <= 0 || rateCurrency <= 0) {
    return { exchange_rate: 1, converted_amount: amount };
  }
  return { exchange_rate: rateBase / rateCurrency, converted_amount: convertAmount(amount, rateCurrency, rateBase) };
}

export function buildOptimisticExpense(qc: QueryClient, p: OptimisticExpenseParams): ExpenseWithSplits {
  const { input } = p;
  const now = new Date().toISOString();
  const fx = resolveOptimisticFx(qc, p.tripId, input.currency, input.amount);
  return {
    id: p.optimisticId,
    trip_id: p.tripId,
    related_type: input.related_type,
    related_id: input.related_id ?? null,
    title: input.title,
    description: input.description?.trim() ? input.description : null,
    amount: input.amount,
    currency: input.currency,
    exchange_rate: fx.exchange_rate,
    converted_amount: fx.converted_amount,
    split_method: input.split_method,
    paid_by: input.paid_by,
    created_by: p.createdBy,
    created_at: now,
    updated_by: null,
    archived_at: null,
    is_business: input.is_business ?? false,
    tip_amount: input.tip_amount ?? 0,
    payer: null,
    expense_splits: [],
  } as ExpenseWithSplits;
}

export interface ExpenseCacheSnapshot {
  feed: InfiniteData<ExpensePage> | undefined;
  all: ExpenseWithSplits[] | undefined;
}

export function snapshotExpenseCaches(qc: QueryClient, tripId: string): ExpenseCacheSnapshot {
  return {
    feed: qc.getQueryData<InfiniteData<ExpensePage>>(feedKey(tripId)),
    all: qc.getQueryData<ExpenseWithSplits[]>(allKey(tripId)),
  };
}

export function restoreExpenseCaches(qc: QueryClient, tripId: string, snap: ExpenseCacheSnapshot): void {
  if (snap.feed !== undefined) qc.setQueryData(feedKey(tripId), snap.feed);
  if (snap.all !== undefined) qc.setQueryData(allKey(tripId), snap.all);
}

/**
 * Prepend the placeholder to the first page of the feed and to the whole-trip list. A cache that
 * isn't loaded is left alone (never fabricate a one-row "complete" list), and re-applying the same
 * optimistic id is a no-op — the rehydrator can run over a cache that already holds the row.
 */
export function addOptimisticExpense(qc: QueryClient, p: OptimisticExpenseParams): void {
  const row = buildOptimisticExpense(qc, p);

  const feed = qc.getQueryData<InfiniteData<ExpensePage>>(feedKey(p.tripId));
  if (feed?.pages.length && !feed.pages.some((pg) => pg.items.some((e) => e.id === p.optimisticId))) {
    const [first, ...rest] = feed.pages;
    qc.setQueryData<InfiniteData<ExpensePage>>(feedKey(p.tripId), {
      ...feed,
      pages: [{ ...first, items: [row, ...first.items] }, ...rest],
    });
  }

  const all = qc.getQueryData<ExpenseWithSplits[]>(allKey(p.tripId));
  if (all && !all.some((e) => e.id === p.optimisticId)) {
    qc.setQueryData<ExpenseWithSplits[]>(allKey(p.tripId), [row, ...all]);
  }
}

/** Drop every placeholder from both caches — run before the post-create refetch lands the real row. */
export function removeOptimisticExpenses(qc: QueryClient, tripId: string): void {
  qc.setQueryData<InfiniteData<ExpensePage> | undefined>(feedKey(tripId), (old) =>
    old && { ...old, pages: old.pages.map((pg) => ({ ...pg, items: pg.items.filter((e) => !isOptimisticId(e.id)) })) },
  );
  qc.setQueryData<ExpenseWithSplits[] | undefined>(allKey(tripId), (old) => old?.filter((e) => !isOptimisticId(e.id)));
}
