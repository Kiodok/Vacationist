import type { QueryClient } from '@tanstack/react-query';
import type { ShoppingItem, ShoppingListWithCounts, UpdateShoppingItemInput } from '@vacationist/types';
import { isOptimisticId } from '../../../utils/optimisticId';

/**
 * Optimistic cache patches for shopping items — shared by the hooks' `onMutate` (live taps) and by
 * the cold-start rehydrator (`utils/optimisticRehydrate.ts`), so a queued offline change looks the
 * same whether the app stayed open or was killed and relaunched.
 *
 * A shopping item lives in TWO query caches that the UI reads separately:
 *   - `['shopping-lists', listId, 'items']`   — the list detail screen
 *   - `['trips', tripId, 'all-shopping-items']` — the "All Items" tab (rows also carry `list_title`)
 * Every patch here writes BOTH. Writing only one is the bug this module exists to fix: an item added
 * offline used to appear in its list but never in All Items (and vice-versa for a status toggle).
 *
 * Patches are no-ops for a cache entry that doesn't exist yet — with two deliberate exceptions for
 * ADDING an item: a list whose items were never loaded is seeded from the item itself (otherwise the
 * item the user just typed offline would simply not appear), and a brand-new list is seeded empty by
 * `addOptimisticShoppingList`. All Items is never fabricated: one row there would read as "the whole
 * trip has one item".
 *
 * Optimistic rows carry the CLIENT-generated UUID that is also sent to the server (`createClientId`),
 * so they are real rows from the start and never need re-keying when the create syncs.
 */

export type AllShoppingItem = ShoppingItem & { list_title: string };

export const shoppingItemsKey = (listId: string) => ['shopping-lists', listId, 'items'] as const;
export const allShoppingItemsKey = (tripId: string) => ['trips', tripId, 'all-shopping-items'] as const;
const shoppingListsKey = (tripId: string) => ['trips', tripId, 'shopping-lists'] as const;

export interface ShoppingCacheSnapshot {
  items: ShoppingItem[] | undefined;
  all: AllShoppingItem[] | undefined;
}

/** `listId` may be unknown (the All Items screen's mutations carry only `tripId`) — that half is then skipped. */
export function snapshotShoppingCaches(qc: QueryClient, listId: string | undefined, tripId: string): ShoppingCacheSnapshot {
  return {
    items: listId ? qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(listId)) : undefined,
    all: qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(tripId)),
  };
}

/** Roll back to a snapshot. An `undefined` half was never cached, so it is left untouched. */
export function restoreShoppingCaches(qc: QueryClient, listId: string | undefined, tripId: string, snap: ShoppingCacheSnapshot): void {
  if (listId && snap.items !== undefined) qc.setQueryData(shoppingItemsKey(listId), snap.items);
  if (snap.all !== undefined) qc.setQueryData(allShoppingItemsKey(tripId), snap.all);
}

/** The list an item belongs to, read from the loaded All Items cache. */
export function findShoppingItemListId(qc: QueryClient, tripId: string, itemId: string): string | undefined {
  return qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(tripId))?.find((i) => i.id === itemId)?.shopping_list_id;
}

/** The list's title, read from the already-cached lists — needed for the all-items row's `list_title`. */
function cachedListTitle(qc: QueryClient, tripId: string, listId: string): string | undefined {
  return qc.getQueryData<ShoppingListWithCounts[]>(shoppingListsKey(tripId))?.find((l) => l.id === listId)?.title;
}

interface OptimisticCreate {
  optimisticId: string;
  listId: string;
  tripId: string;
  title: string;
  createdBy: string;
}

export function buildOptimisticShoppingItem(o: OptimisticCreate, position: number): ShoppingItem {
  const now = new Date().toISOString();
  return {
    id: o.optimisticId,
    // The real trip id, not '' — the all-items list is filtered/grouped by it.
    trip_id: o.tripId,
    shopping_list_id: o.listId,
    title: o.title,
    quantity: null,
    unit: null,
    notes: null,
    position,
    status: 'open',
    source_recipe_id: null,
    source_ingredient_id: null,
    created_by: o.createdBy,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

interface OptimisticListCreate {
  id: string;
  tripId: string;
  title: string;
  createdBy: string;
}

/** Add a just-created list to the trip's lists cache and seed its (empty) items cache. Idempotent. */
export function addOptimisticShoppingList(qc: QueryClient, o: OptimisticListCreate): void {
  const now = new Date().toISOString();
  const list: ShoppingListWithCounts = {
    id: o.id,
    trip_id: o.tripId,
    title: o.title,
    created_by: o.createdBy,
    created_at: now,
    updated_at: now,
    archived_at: null,
    item_count: 0,
    bought_count: 0,
  };
  qc.setQueryData<ShoppingListWithCounts[]>(shoppingListsKey(o.tripId), (old) =>
    old?.some((l) => l.id === o.id) ? old : [...(old ?? []), list],
  );
  qc.setQueryData<ShoppingItem[]>(shoppingItemsKey(o.id), (old) => old ?? []);
}

/** Append an optimistic item to both caches (skipping a cache that already has this id). */
export function addOptimisticShoppingItem(qc: QueryClient, o: OptimisticCreate): void {
  const items = qc.getQueryData<ShoppingItem[]>(shoppingItemsKey(o.listId));
  const listKnown = cachedListTitle(qc, o.tripId, o.listId) !== undefined;
  if (items) {
    if (!items.some((i) => i.id === o.optimisticId)) {
      qc.setQueryData<ShoppingItem[]>(shoppingItemsKey(o.listId), [...items, buildOptimisticShoppingItem(o, items.length)]);
    }
  } else if (listKnown) {
    // The list exists but its items were never cached. Seed it with this item so the add is visible;
    // the reconnect refetch fills in the rest.
    qc.setQueryData<ShoppingItem[]>(shoppingItemsKey(o.listId), [buildOptimisticShoppingItem(o, 0)]);
  }

  const all = qc.getQueryData<AllShoppingItem[]>(allShoppingItemsKey(o.tripId));
  if (all && !all.some((i) => i.id === o.optimisticId)) {
    // Without a title the row would land under an `undefined` section header in All Items; it will
    // appear as soon as the reconnect refetch runs, which is better than a broken header.
    const listTitle = cachedListTitle(qc, o.tripId, o.listId);
    if (listTitle !== undefined) {
      const row: AllShoppingItem = { ...buildOptimisticShoppingItem(o, all.length), list_title: listTitle };
      qc.setQueryData<AllShoppingItem[]>(allShoppingItemsKey(o.tripId), [...all, row]);
    }
  }
}

/**
 * Replace the optimistic placeholder(s) with the server's real row in both caches. Dedupes against a
 * realtime INSERT that already landed.
 */
export function resolveCreatedShoppingItem(qc: QueryClient, newItem: ShoppingItem, listId: string, tripId: string): void {
  // Same-id row (the client-minted id) is replaced in place with the server's copy; legacy `__optimistic-`
  // placeholders (queue entries from an older build) are dropped as before.
  qc.setQueryData<ShoppingItem[]>(shoppingItemsKey(listId), (old) => {
    if (!old) return old;
    const base = old.filter((i) => !isOptimisticId(i.id));
    return base.some((i) => i.id === newItem.id) ? base.map((i) => (i.id === newItem.id ? newItem : i)) : [...base, newItem];
  });

  qc.setQueryData<AllShoppingItem[]>(allShoppingItemsKey(tripId), (old) => {
    if (!old) return old;
    const base = old.filter((i) => !isOptimisticId(i.id));
    const listTitle = cachedListTitle(qc, tripId, listId);
    if (base.some((i) => i.id === newItem.id)) {
      return base.map((i) => (i.id === newItem.id ? { ...newItem, list_title: i.list_title } : i));
    }
    // No title → leave it to the invalidate that follows rather than render a header-less row.
    return listTitle === undefined ? base : [...base, { ...newItem, list_title: listTitle }];
  });
}

/** Patch one item in both caches. `listId` may be unknown (the all-items screen doesn't carry it) — it's looked up. */
export function patchShoppingItem(
  qc: QueryClient,
  { itemId, listId, tripId, patch }: { itemId: string; listId?: string; tripId: string; patch: UpdateShoppingItemInput },
): void {
  const resolvedListId = listId ?? findShoppingItemListId(qc, tripId, itemId);

  if (resolvedListId) {
    qc.setQueryData<ShoppingItem[]>(shoppingItemsKey(resolvedListId), (old) =>
      old?.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    );
  }
  qc.setQueryData<AllShoppingItem[]>(allShoppingItemsKey(tripId), (old) =>
    old?.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
  );
}

export function removeShoppingItem(qc: QueryClient, { itemId, listId, tripId }: { itemId: string; listId: string; tripId: string }): void {
  qc.setQueryData<ShoppingItem[]>(shoppingItemsKey(listId), (old) => old?.filter((i) => i.id !== itemId));
  qc.setQueryData<AllShoppingItem[]>(allShoppingItemsKey(tripId), (old) => old?.filter((i) => i.id !== itemId));
}
