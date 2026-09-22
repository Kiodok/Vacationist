import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// optimisticId imports expo-crypto, which cannot load in the node test env.
vi.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid' }));

import { QueryClient, hydrate, type InfiniteData } from '@tanstack/react-query';
import type { ExpenseWithSplits, ShoppingItem, ShoppingListWithCounts, CreateExpenseInput } from '@vacationist/types';
import { reapplyOptimisticRows, OPTIMISTIC_REHYDRATOR_KEYS } from './optimisticRehydrate';
import { isOptimisticId } from './optimisticId';
import { stripOptimisticRows } from './persistOptimistic';

const TRIP = 'trip-1';
const LIST = 'list-1';

function shoppingItem(id: string): ShoppingItem {
  return {
    id, trip_id: TRIP, shopping_list_id: LIST, title: id, quantity: null, unit: null, notes: null,
    position: 0, status: 'open', source_recipe_id: null, source_ingredient_id: null,
    created_by: 'u1', created_at: 't', updated_at: 't', deleted_at: null,
  };
}

/** Hydrate a queued mutation exactly the way `hydrateMutationQueue` does (same `hydrate()` call). */
function queueMutation(qc: QueryClient, mutationKey: string, variables: unknown, submittedAt = 1000) {
  hydrate(qc, {
    mutations: [
      {
        mutationKey: [mutationKey],
        state: {
          context: undefined, data: undefined, error: null, failureCount: 0, failureReason: null,
          isPaused: true, status: 'pending', variables, submittedAt,
        },
      },
    ],
    queries: [],
  });
}

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient();
  qc.setQueryData(['trips', TRIP, 'shopping-lists'], [{ id: LIST, title: 'Groceries' }] as unknown as ShoppingListWithCounts[]);
});

describe('reapplyOptimisticRows — the restart-while-offline bug', () => {
  // The exact reported bug: queue survives a kill, but the row it produced doesn't.
  it('brings an offline-added shopping item back after a restart, in BOTH the list and All Items', () => {
    // What was written to disk: the caches WITHOUT the optimistic row (stripOptimisticRows removed it).
    qc.setQueryData(['shopping-lists', LIST, 'items'], stripOptimisticRows([shoppingItem('a')]));
    qc.setQueryData(['trips', TRIP, 'all-shopping-items'], stripOptimisticRows([{ ...shoppingItem('a'), list_title: 'Groceries' }]));
    // ...and the persisted queue, hydrated at boot.
    queueMutation(qc, 'createShoppingItem', { listId: LIST, tripId: TRIP, input: { title: 'Milk' } });

    expect(reapplyOptimisticRows(qc, () => 'me')).toBe(1);

    const list = qc.getQueryData<ShoppingItem[]>(['shopping-lists', LIST, 'items'])!;
    const all = qc.getQueryData<Array<ShoppingItem & { list_title: string }>>(['trips', TRIP, 'all-shopping-items'])!;
    expect(list.map((i) => i.title)).toEqual(['a', 'Milk']);
    expect(all.map((i) => i.title)).toEqual(['a', 'Milk']);
    expect(isOptimisticId(list[1].id)).toBe(true);
    expect(all[1].list_title).toBe('Groceries');
    expect(list[1].created_by).toBe('me');
  });

  it('re-applies a queued delete and a queued toggle', () => {
    qc.setQueryData(['shopping-lists', LIST, 'items'], [shoppingItem('a'), shoppingItem('b')]);
    qc.setQueryData(['trips', TRIP, 'all-shopping-items'], [
      { ...shoppingItem('a'), list_title: 'Groceries' }, { ...shoppingItem('b'), list_title: 'Groceries' },
    ]);
    queueMutation(qc, 'deleteShoppingItem', { itemId: 'a', listId: LIST, tripId: TRIP }, 1);
    queueMutation(qc, 'updateShoppingItemGlobal', { itemId: 'b', tripId: TRIP, input: { status: 'bought' } }, 2);

    expect(reapplyOptimisticRows(qc, () => 'me')).toBe(2);

    expect(qc.getQueryData<ShoppingItem[]>(['shopping-lists', LIST, 'items'])!.map((i) => [i.id, i.status])).toEqual([['b', 'bought']]);
    expect(qc.getQueryData<ShoppingItem[]>(['trips', TRIP, 'all-shopping-items'])!.map((i) => [i.id, i.status])).toEqual([['b', 'bought']]);
  });

  it('brings an offline-created expense back at the top of the feed and the whole-trip list', () => {
    const existing = { id: 'e1', title: 'Old' } as ExpenseWithSplits;
    const feed: InfiniteData<{ items: ExpenseWithSplits[]; hasMore: boolean }> = {
      pages: [{ items: [existing], hasMore: false }], pageParams: [0],
    };
    qc.setQueryData(['trips', TRIP, 'expenses'], feed);
    qc.setQueryData(['trips', TRIP, 'expenses', 'all'], [existing]);
    const input = {
      title: 'Dinner', amount: 55, currency: 'EUR', paid_by: 'u1', related_type: 'food_drink',
      split_method: 'even', splits: [{ user_id: 'u1' }], tip_amount: 7,
    } as CreateExpenseInput;
    queueMutation(qc, 'createExpense', { tripId: TRIP, input });

    expect(reapplyOptimisticRows(qc, () => 'me')).toBe(1);

    const page0 = qc.getQueryData<typeof feed>(['trips', TRIP, 'expenses'])!.pages[0].items;
    expect(page0.map((e) => e.title)).toEqual(['Dinner', 'Old']);
    expect(page0[0].tip_amount).toBe(7);
    expect(page0[0].related_type).toBe('food_drink');
    expect(isOptimisticId(page0[0].id)).toBe(true);
    expect(qc.getQueryData<ExpenseWithSplits[]>(['trips', TRIP, 'expenses', 'all'])!.map((e) => e.title)).toEqual(['Dinner', 'Old']);
  });
});

describe('reapplyOptimisticRows — safety', () => {
  it('is idempotent: running twice never duplicates a placeholder', () => {
    qc.setQueryData(['shopping-lists', LIST, 'items'], []);
    queueMutation(qc, 'createShoppingItem', { listId: LIST, tripId: TRIP, input: { title: 'Milk' } });

    reapplyOptimisticRows(qc, () => 'me');
    reapplyOptimisticRows(qc, () => 'me');

    expect(qc.getQueryData<ShoppingItem[]>(['shopping-lists', LIST, 'items'])).toHaveLength(1);
  });

  it('gives two queued creates from the same millisecond distinct placeholders', () => {
    qc.setQueryData(['shopping-lists', LIST, 'items'], []);
    queueMutation(qc, 'createShoppingItem', { listId: LIST, tripId: TRIP, input: { title: 'Milk' } }, 5000);
    queueMutation(qc, 'createShoppingItem', { listId: LIST, tripId: TRIP, input: { title: 'Eggs' } }, 5000);

    expect(reapplyOptimisticRows(qc, () => 'me')).toBe(2);
    expect(qc.getQueryData<ShoppingItem[]>(['shopping-lists', LIST, 'items'])!.map((i) => i.title)).toEqual(['Milk', 'Eggs']);
  });

  it('never throws on a malformed persisted variable, and still applies the rest', () => {
    qc.setQueryData(['shopping-lists', LIST, 'items'], []);
    queueMutation(qc, 'createShoppingItem', undefined, 1); // corrupt
    queueMutation(qc, 'createShoppingItem', { listId: LIST, tripId: TRIP, input: { title: 'Milk' } }, 2);

    expect(() => reapplyOptimisticRows(qc, () => 'me')).not.toThrow();
    expect(qc.getQueryData<ShoppingItem[]>(['shopping-lists', LIST, 'items'])!.map((i) => i.title)).toEqual(['Milk']);
  });

  it('survives getUserId throwing (auth not initialised yet)', () => {
    qc.setQueryData(['shopping-lists', LIST, 'items'], []);
    queueMutation(qc, 'createShoppingItem', { listId: LIST, tripId: TRIP, input: { title: 'Milk' } });

    expect(() => reapplyOptimisticRows(qc, () => { throw new Error('no auth'); })).not.toThrow();
    expect(qc.getQueryData<ShoppingItem[]>(['shopping-lists', LIST, 'items'])![0].created_by).toBe('');
  });

  it('ignores mutations with no registered rehydrator', () => {
    queueMutation(qc, 'someOtherMutation', { anything: true });
    expect(reapplyOptimisticRows(qc, () => 'me')).toBe(0);
  });

  it('never fabricates All Items, but seeds a never-loaded per-list cache for a known list', () => {
    queueMutation(qc, 'createShoppingItem', { listId: LIST, tripId: TRIP, input: { title: 'Milk' } });
    reapplyOptimisticRows(qc, () => 'me');
    expect(qc.getQueryData(['trips', TRIP, 'all-shopping-items'])).toBeUndefined();
    // the list is known (fixture caches it), so its never-loaded items cache is seeded from the item
    expect(qc.getQueryData<{ title: string }[]>(['shopping-lists', LIST, 'items'])!.map((i) => i.title)).toEqual(['Milk']);
  });

  it('uses the client-minted id from the variables, so a persisted row and a re-applied one are the same row', () => {
    qc.setQueryData(['shopping-lists', LIST, 'items'], []);
    queueMutation(qc, 'createShoppingItem', { listId: LIST, tripId: TRIP, input: { title: 'Milk' }, id: 'client-uuid-1' });
    reapplyOptimisticRows(qc, () => 'me');
    reapplyOptimisticRows(qc, () => 'me');
    const items = qc.getQueryData<{ id: string }[]>(['shopping-lists', LIST, 'items'])!;
    expect(items.map((i) => i.id)).toEqual(['client-uuid-1']);
  });
});

describe('registry', () => {
  // queryClient.ts can't load in the node test env (Sentry, i18n, toasts), so parse the key list as
  // text — the same approach as persistedMutationKeys.test.ts.
  function persistedKeys(): Set<string> {
    const src = readFileSync(join(__dirname, 'queryClient.ts'), 'utf8');
    const block = src.slice(src.indexOf('PERSISTED_MUTATION_KEYS = ['), src.indexOf('] as const;'));
    return new Set([...block.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]));
  }

  // A rehydrator for a mutation that is never persisted would be dead code that looks meaningful.
  it('only registers keys that are actually persisted', () => {
    const persisted = persistedKeys();
    expect(persisted.size).toBeGreaterThan(50); // parser sanity
    for (const key of OPTIMISTIC_REHYDRATOR_KEYS) {
      expect(persisted.has(key), `${key} has a rehydrator but is not in PERSISTED_MUTATION_KEYS`).toBe(true);
    }
  });
});
