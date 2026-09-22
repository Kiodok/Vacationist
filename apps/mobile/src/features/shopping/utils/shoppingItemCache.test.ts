import { describe, it, expect, vi, beforeEach } from 'vitest';

// optimisticId imports expo-crypto, which cannot load in the node test env.
vi.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid' }));

import { QueryClient } from '@tanstack/react-query';
import type { ShoppingItem, ShoppingListWithCounts } from '@vacationist/types';
import {
  addOptimisticShoppingItem,
  addOptimisticShoppingList,
  resolveCreatedShoppingItem,
  patchShoppingItem,
  removeShoppingItem,
  snapshotShoppingCaches,
  restoreShoppingCaches,
  shoppingItemsKey,
  allShoppingItemsKey,
  type AllShoppingItem,
} from './shoppingItemCache';

const TRIP = 'trip-1';
const LIST = 'list-1';
const OPT = '__optimistic-aaa';

function item(id: string, over: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id, trip_id: TRIP, shopping_list_id: LIST, title: id, quantity: null, unit: null, notes: null,
    position: 0, status: 'open', source_recipe_id: null, source_ingredient_id: null,
    created_by: 'u1', created_at: 't', updated_at: 't', deleted_at: null, ...over,
  };
}
const allItem = (id: string, over: Partial<ShoppingItem> = {}): AllShoppingItem => ({ ...item(id, over), list_title: 'Groceries' });

const lists = [{ id: LIST, title: 'Groceries' }] as unknown as ShoppingListWithCounts[];
const create = { optimisticId: OPT, listId: LIST, tripId: TRIP, title: 'Milk', createdBy: 'u1' };

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient();
  qc.setQueryData(['trips', TRIP, 'shopping-lists'], lists);
});

describe('addOptimisticShoppingItem', () => {
  // The reported bug: an item added offline appeared in its list but never in "All Items".
  it('writes the item into BOTH the per-list cache and the All Items cache', () => {
    qc.setQueryData(shoppingItemsKey(LIST), [item('a')]);
    qc.setQueryData(allShoppingItemsKey(TRIP), [allItem('a')]);

    addOptimisticShoppingItem(qc, create);

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))!.map((i) => i.id)).toEqual(['a', OPT]);
    expect(qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))!.map((i) => i.id)).toEqual(['a', OPT]);
  });

  it('gives the optimistic row the real trip_id and list_title (used to be trip_id "" and no title)', () => {
    qc.setQueryData(shoppingItemsKey(LIST), []);
    qc.setQueryData(allShoppingItemsKey(TRIP), []);

    addOptimisticShoppingItem(qc, create);

    const row = qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))![0];
    expect(row.trip_id).toBe(TRIP);
    expect(row.list_title).toBe('Groceries');
    expect(row.status).toBe('open');
    expect(row.title).toBe('Milk');
  });

  // Adding an item never requires All Items to have been loaded. Writing `[optimistic]` into a
  // missing entry would make the tab render that single item as the entire list.
  it('does NOT fabricate an All Items cache that was never loaded', () => {
    qc.setQueryData(shoppingItemsKey(LIST), [item('a')]);

    addOptimisticShoppingItem(qc, create);

    expect(qc.getQueryData(allShoppingItemsKey(TRIP))).toBeUndefined();
    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))).toHaveLength(2);
  });

  // Device-test finding (v1.39.0 round 2): an item added offline to a list whose items were never
  // cached simply vanished. The list itself is known, so seed its cache from the item.
  it('seeds the per-list cache from the item when the list is known but its items were never loaded', () => {
    addOptimisticShoppingItem(qc, create);
    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))!.map((i) => i.id)).toEqual([OPT]);
    expect(qc.getQueryData(allShoppingItemsKey(TRIP))).toBeUndefined();
  });

  it('still fabricates nothing when even the list is unknown', () => {
    qc.setQueryData(['trips', TRIP, 'shopping-lists'], []);
    addOptimisticShoppingItem(qc, create);
    expect(qc.getQueryData(shoppingItemsKey(LIST))).toBeUndefined();
  });

  it('skips the All Items row (rather than render a header-less one) when the list title is unknown', () => {
    qc.setQueryData(['trips', TRIP, 'shopping-lists'], []); // lists not cached
    qc.setQueryData(shoppingItemsKey(LIST), []);
    qc.setQueryData(allShoppingItemsKey(TRIP), []);

    addOptimisticShoppingItem(qc, create);

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))).toHaveLength(1);
    expect(qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))).toHaveLength(0);
  });

  // The cold-start rehydrator may run over a cache that already holds the row.
  it('is idempotent — re-applying the same optimistic id never duplicates the row', () => {
    qc.setQueryData(shoppingItemsKey(LIST), []);
    qc.setQueryData(allShoppingItemsKey(TRIP), []);

    addOptimisticShoppingItem(qc, create);
    addOptimisticShoppingItem(qc, create);

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))).toHaveLength(1);
    expect(qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))).toHaveLength(1);
  });
});

describe('resolveCreatedShoppingItem', () => {
  it('swaps the optimistic placeholder for the server row in both caches', () => {
    qc.setQueryData(shoppingItemsKey(LIST), [item('a')]);
    qc.setQueryData(allShoppingItemsKey(TRIP), [allItem('a')]);
    addOptimisticShoppingItem(qc, create);

    resolveCreatedShoppingItem(qc, item('real-1', { title: 'Milk' }), LIST, TRIP);

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))!.map((i) => i.id)).toEqual(['a', 'real-1']);
    const all = qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))!;
    expect(all.map((i) => i.id)).toEqual(['a', 'real-1']);
    expect(all[1].list_title).toBe('Groceries');
  });

  // Client-generated ids (v1.39.0): the optimistic row already carries the id the server will confirm,
  // so the server copy must REPLACE it in place rather than be skipped as a duplicate.
  it('replaces a same-id optimistic row with the server copy', () => {
    qc.setQueryData(shoppingItemsKey(LIST), [item('real-1', { title: 'local', created_at: 'fake' })]);
    qc.setQueryData(allShoppingItemsKey(TRIP), [allItem('real-1', { title: 'local' })]);

    resolveCreatedShoppingItem(qc, item('real-1', { title: 'server', created_at: 'real' }), LIST, TRIP);

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))).toEqual([item('real-1', { title: 'server', created_at: 'real' })]);
    const all = qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))!;
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('server');
    expect(all[0].list_title).toBe('Groceries');
  });

  it('dedupes against a realtime INSERT that already landed', () => {
    qc.setQueryData(shoppingItemsKey(LIST), [item('real-1'), { ...item('x'), id: OPT }]);
    qc.setQueryData(allShoppingItemsKey(TRIP), [allItem('real-1')]);

    resolveCreatedShoppingItem(qc, item('real-1'), LIST, TRIP);

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))!.map((i) => i.id)).toEqual(['real-1']);
    expect(qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))!.map((i) => i.id)).toEqual(['real-1']);
  });

  it('leaves an unloaded cache unloaded', () => {
    resolveCreatedShoppingItem(qc, item('real-1'), LIST, TRIP);
    expect(qc.getQueryData(shoppingItemsKey(LIST))).toBeUndefined();
    expect(qc.getQueryData(allShoppingItemsKey(TRIP))).toBeUndefined();
  });
});

describe('addOptimisticShoppingList', () => {
  // The OFF4 finding: no item could be added to a list created offline. The list needs an (empty)
  // items cache from birth so its screen renders and accepts adds.
  it('adds the list and seeds an empty items cache for it', () => {
    addOptimisticShoppingList(qc, { id: 'new-list', tripId: TRIP, title: 'Kitchen', createdBy: 'u1' });

    const cached = qc.getQueryData<ShoppingListWithCounts[]>(['trips', TRIP, 'shopping-lists'])!;
    expect(cached.map((l) => l.id)).toEqual([LIST, 'new-list']);
    expect(qc.getQueryData(shoppingItemsKey('new-list'))).toEqual([]);
  });

  it('is idempotent and never clobbers items already in the list cache', () => {
    addOptimisticShoppingList(qc, { id: 'new-list', tripId: TRIP, title: 'Kitchen', createdBy: 'u1' });
    qc.setQueryData(shoppingItemsKey('new-list'), [item('x', { shopping_list_id: 'new-list' })]);

    addOptimisticShoppingList(qc, { id: 'new-list', tripId: TRIP, title: 'Kitchen', createdBy: 'u1' });

    expect(qc.getQueryData<ShoppingListWithCounts[]>(['trips', TRIP, 'shopping-lists'])).toHaveLength(2);
    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey('new-list'))).toHaveLength(1);
  });
});

describe('patchShoppingItem', () => {
  beforeEach(() => {
    qc.setQueryData(shoppingItemsKey(LIST), [item('a'), item('b')]);
    qc.setQueryData(allShoppingItemsKey(TRIP), [allItem('a'), allItem('b')]);
  });

  it('patches both caches when the list id is known (toggle from the list screen)', () => {
    patchShoppingItem(qc, { itemId: 'a', listId: LIST, tripId: TRIP, patch: { status: 'bought' } });

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))![0].status).toBe('bought');
    expect(qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))![0].status).toBe('bought');
    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))![1].status).toBe('open');
  });

  // The All Items screen has no list id in its mutation variables — the per-list cache used to go
  // stale after a toggle made there.
  it('finds the list itself when only the trip is known (toggle from the All Items screen)', () => {
    patchShoppingItem(qc, { itemId: 'b', tripId: TRIP, patch: { status: 'bought' } });

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))![1].status).toBe('bought');
    expect(qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))![1].status).toBe('bought');
  });
});

describe('removeShoppingItem', () => {
  it('removes the item from both caches', () => {
    qc.setQueryData(shoppingItemsKey(LIST), [item('a'), item('b')]);
    qc.setQueryData(allShoppingItemsKey(TRIP), [allItem('a'), allItem('b')]);

    removeShoppingItem(qc, { itemId: 'a', listId: LIST, tripId: TRIP });

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))!.map((i) => i.id)).toEqual(['b']);
    expect(qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))!.map((i) => i.id)).toEqual(['b']);
  });
});

describe('snapshot / restore', () => {
  it('rolls both caches back to their pre-mutation state', () => {
    qc.setQueryData(shoppingItemsKey(LIST), [item('a')]);
    qc.setQueryData(allShoppingItemsKey(TRIP), [allItem('a')]);
    const snap = snapshotShoppingCaches(qc, LIST, TRIP);

    addOptimisticShoppingItem(qc, create);
    restoreShoppingCaches(qc, LIST, TRIP, snap);

    expect(qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(LIST))!.map((i) => i.id)).toEqual(['a']);
    expect(qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(TRIP))!.map((i) => i.id)).toEqual(['a']);
  });

  it('does not write a cache that was never loaded', () => {
    const snap = snapshotShoppingCaches(qc, LIST, TRIP);
    restoreShoppingCaches(qc, LIST, TRIP, snap);
    expect(qc.getQueryData(shoppingItemsKey(LIST))).toBeUndefined();
    expect(qc.getQueryData(allShoppingItemsKey(TRIP))).toBeUndefined();
  });
});
