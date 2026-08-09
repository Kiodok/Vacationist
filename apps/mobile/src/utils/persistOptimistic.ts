import { isOptimisticId } from './optimisticId';

// Shape of a TanStack `InfiniteData<Page, PageParam>` cache entry where each
// page carries its rows under `items` — the convention used by every
// paginated query in this app (expenses' {items, hasMore}, chat's
// {items, nextCursor}, activities' {items, hasMore}).
interface PageLike {
  items: unknown[];
}

interface InfiniteLike {
  pages: PageLike[];
  pageParams: unknown[];
}

function isOptimisticRow(item: unknown): boolean {
  return (
    !!item &&
    typeof item === 'object' &&
    'id' in item &&
    typeof (item as { id: unknown }).id === 'string' &&
    isOptimisticId((item as { id: string }).id)
  );
}

function isInfiniteWithItems(data: unknown): data is InfiniteLike {
  if (!data || typeof data !== 'object') return false;
  const pages = (data as { pages?: unknown }).pages;
  const pageParams = (data as { pageParams?: unknown }).pageParams;
  if (!Array.isArray(pages) || !Array.isArray(pageParams)) return false;
  return pages.every(
    (p) => !!p && typeof p === 'object' && Array.isArray((p as { items?: unknown }).items),
  );
}

/**
 * Strips optimistic (not-yet-server-confirmed) rows out of a query cache
 * entry before it is persisted to disk, so a killed app never rehydrates
 * phantom rows that the server never actually created.
 *
 * Handles two shapes:
 *  - a plain array (the original, pre-pagination convention)
 *  - `InfiniteData<{ items: T[] }, PageParam>` (every paginated query in this
 *    app) — `pageParams` is carried through verbatim; only `pages[].items` is
 *    filtered, since `getNextPageParam` depends on `pages.length` matching
 *    `pageParams.length`.
 *
 * Any other shape (single-object queries, etc.) is returned untouched.
 */
export function stripOptimisticRows(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.filter((item) => !isOptimisticRow(item));
  }
  if (isInfiniteWithItems(data)) {
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => !isOptimisticRow(item)),
      })),
    };
  }
  return data;
}
