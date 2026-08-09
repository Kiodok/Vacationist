import { describe, it, expect, vi } from 'vitest';

// optimisticId imports expo-crypto, which cannot load in the node test env.
vi.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid' }));

import { createOptimisticId } from './optimisticId';
import { stripOptimisticRows } from './persistOptimistic';

describe('stripOptimisticRows', () => {
  it('filters optimistic rows out of a plain array', () => {
    const optimisticId = createOptimisticId();
    const data = [{ id: 'real-1' }, { id: optimisticId }, { id: 'real-2' }];
    expect(stripOptimisticRows(data)).toEqual([{ id: 'real-1' }, { id: 'real-2' }]);
  });

  it('leaves a plain array with no optimistic rows untouched in content', () => {
    const data = [{ id: 'a' }, { id: 'b' }];
    expect(stripOptimisticRows(data)).toEqual(data);
  });

  it('filters optimistic rows out of an expenses-shaped InfiniteData ({items, hasMore})', () => {
    const optimisticId = createOptimisticId();
    const data = {
      pages: [
        { items: [{ id: 'e1' }, { id: optimisticId }], hasMore: true },
        { items: [{ id: 'e2' }], hasMore: false },
      ],
      pageParams: [0, 30],
    };
    const result = stripOptimisticRows(data) as typeof data;
    expect(result.pages[0].items.map((i) => i.id)).toEqual(['e1']);
    expect(result.pages[0].hasMore).toBe(true);
    expect(result.pages[1].items.map((i) => i.id)).toEqual(['e2']);
    expect(result.pageParams).toEqual([0, 30]);
  });

  it('filters optimistic rows out of a chat-shaped InfiniteData ({items, nextCursor})', () => {
    const optimisticId = createOptimisticId();
    const data = {
      pages: [{ items: [{ id: optimisticId }, { id: 'm1' }], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = stripOptimisticRows(data) as typeof data;
    expect(result.pages[0].items.map((i) => i.id)).toEqual(['m1']);
    expect(result.pages[0].nextCursor).toBeNull();
  });

  it('preserves pageParams verbatim, including undefined entries', () => {
    const data = {
      pages: [{ items: [{ id: 'a' }] }, { items: [{ id: 'b' }] }],
      pageParams: [undefined, 'cursor-2'],
    };
    const result = stripOptimisticRows(data) as typeof data;
    expect(result.pageParams).toEqual([undefined, 'cursor-2']);
    expect(result.pages).toHaveLength(2);
  });

  it('returns non-list data untouched (single-object query cache)', () => {
    const data = { id: 'trip-1', title: 'Summer trip' };
    expect(stripOptimisticRows(data)).toBe(data);
  });

  it('returns null/undefined untouched', () => {
    expect(stripOptimisticRows(null)).toBeNull();
    expect(stripOptimisticRows(undefined)).toBeUndefined();
  });

  it('does not misidentify a non-InfiniteData object with a pages-like key', () => {
    const data = { pages: 'not-an-array', pageParams: [] };
    expect(stripOptimisticRows(data)).toBe(data);
  });
});
