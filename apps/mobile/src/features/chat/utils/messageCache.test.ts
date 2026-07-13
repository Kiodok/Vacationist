import { describe, it, expect, vi } from 'vitest';

// optimisticId imports expo-crypto, which cannot load in the node test env.
vi.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid' }));

import type { TripMessageWithSender } from '@vacationist/types';
import {
  prependMessage,
  replaceMessage,
  removeMessage,
  resolveOptimistic,
  type MessagesData,
} from './messageCache';

function msg(overrides: Partial<TripMessageWithSender> & { id: string }): TripMessageWithSender {
  return {
    trip_id: 'trip-1',
    created_by: 'user-1',
    text: 'hello',
    created_at: '2026-07-13T10:00:00.000Z',
    updated_at: '2026-07-13T10:00:00.000Z',
    deleted_at: null,
    sender: { name: 'Alice', avatar_url: null },
    ...overrides,
  };
}

function data(pages: TripMessageWithSender[][], cursors?: (string | null)[]): MessagesData {
  return {
    pages: pages.map((items, i) => ({ items, nextCursor: cursors?.[i] ?? null })),
    pageParams: pages.map((_, i) => (i === 0 ? undefined : `cursor-${i}`)),
  };
}

describe('prependMessage', () => {
  it('bootstraps the cache when data is undefined', () => {
    const result = prependMessage(undefined, msg({ id: 'a' }));
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].items.map((m) => m.id)).toEqual(['a']);
    expect(result.pages[0].nextCursor).toBeNull();
    expect(result.pageParams).toEqual([undefined]);
  });

  it('inserts at the top of the first page only', () => {
    const existing = data([[msg({ id: 'b' })], [msg({ id: 'c' })]]);
    const result = prependMessage(existing, msg({ id: 'a' }));
    expect(result.pages[0].items.map((m) => m.id)).toEqual(['a', 'b']);
    expect(result.pages[1].items.map((m) => m.id)).toEqual(['c']);
  });

  it('is a no-op when the id already exists in any page', () => {
    const existing = data([[msg({ id: 'a' })], [msg({ id: 'b' })]]);
    expect(prependMessage(existing, msg({ id: 'b' }))).toBe(existing);
  });
});

describe('replaceMessage', () => {
  it('patches the matching message across pages', () => {
    const existing = data([[msg({ id: 'a' })], [msg({ id: 'b', text: 'old' })]]);
    const result = replaceMessage(existing, { id: 'b', text: 'new' });
    expect(result.pages[1].items[0].text).toBe('new');
    expect(result.pages[0].items[0].text).toBe('hello');
  });

  it('preserves the cached sender when the patch has none (realtime payload)', () => {
    const existing = data([[msg({ id: 'a', sender: { name: 'Alice', avatar_url: 'x' } })]]);
    const result = replaceMessage(existing, { id: 'a', text: 'edited' });
    expect(result.pages[0].items[0].sender).toEqual({ name: 'Alice', avatar_url: 'x' });
  });
});

describe('removeMessage', () => {
  it('removes the message from any page (soft delete arrives as UPDATE)', () => {
    const existing = data([[msg({ id: 'a' })], [msg({ id: 'b' })]]);
    const result = removeMessage(existing, 'b');
    expect(result.pages[0].items.map((m) => m.id)).toEqual(['a']);
    expect(result.pages[1].items).toEqual([]);
  });
});

describe('resolveOptimistic', () => {
  const optimistic = msg({ id: '__optimistic-1', created_by: 'user-1', text: 'sent offline' });
  const real = msg({ id: 'real-1', created_by: 'user-1', text: 'sent offline' });

  it('replaces the optimistic twin with the confirmed message', () => {
    const existing = data([[optimistic, msg({ id: 'a' })]]);
    const result = resolveOptimistic(existing, real);
    expect(result.pages[0].items.map((m) => m.id)).toEqual(['real-1', 'a']);
  });

  it('removes only one twin when the same text was sent twice', () => {
    const twin2 = msg({ id: '__optimistic-2', created_by: 'user-1', text: 'sent offline' });
    const existing = data([[optimistic, twin2]]);
    const result = resolveOptimistic(existing, real);
    expect(result.pages[0].items.map((m) => m.id)).toEqual(['real-1', '__optimistic-2']);
  });

  it('does not remove another user\'s optimistic message with the same text', () => {
    const other = msg({ id: '__optimistic-3', created_by: 'user-2', text: 'sent offline' });
    const existing = data([[other]]);
    const result = resolveOptimistic(existing, real);
    expect(result.pages[0].items.map((m) => m.id)).toEqual(['real-1', '__optimistic-3']);
  });

  it('is a no-op when the confirmed message already arrived via realtime', () => {
    const existing = data([[real, msg({ id: 'a' })]]);
    const result = resolveOptimistic(existing, real);
    expect(result.pages[0].items.map((m) => m.id)).toEqual(['real-1', 'a']);
  });

  it('bootstraps the cache when data is undefined', () => {
    const result = resolveOptimistic(undefined, real);
    expect(result.pages[0].items.map((m) => m.id)).toEqual(['real-1']);
  });
});
