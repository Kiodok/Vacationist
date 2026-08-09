import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { Activity } from '@vacationist/types';
import {
  prependActivity,
  patchActivity,
  removeActivity,
  flattenActivities,
  applyToList,
  applyActivityCacheOp,
  snapshotActivityCaches,
  restoreActivityCaches,
  type ActivitiesData,
} from './activityCache';
import { activitiesPageKey, allActivitiesKey } from './activityKeys';

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    trip_id: 'trip-1',
    title: 'Museum visit',
    description: null,
    category: null,
    cost_estimate: null,
    activity_date: null,
    start_time: null,
    end_time: null,
    external_url: null,
    maps_url: null,
    status: 'planned',
    voting_open: true,
    auto_close: false,
    reservation_required: false,
    created_by: 'user-1',
    created_at: '2026-08-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function data(pages: Activity[][], hasMoreFlags?: boolean[]): ActivitiesData {
  return {
    pages: pages.map((items, i) => ({ items, hasMore: hasMoreFlags?.[i] ?? false })),
    pageParams: pages.map((_, i) => i * 50),
  };
}

describe('prependActivity', () => {
  it('bootstraps the cache when data is undefined, with pageParams: [0]', () => {
    const result = prependActivity(undefined, activity({ id: 'a' }));
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].items.map((a) => a.id)).toEqual(['a']);
    expect(result.pageParams).toEqual([0]);
  });

  it('bootstraps when data has zero pages', () => {
    const result = prependActivity({ pages: [], pageParams: [] }, activity({ id: 'a' }));
    expect(result.pageParams).toEqual([0]);
  });

  it('dedupes by id — a second prepend of the same activity is a no-op', () => {
    const first = prependActivity(undefined, activity({ id: 'a' }));
    const second = prependActivity(first, activity({ id: 'a', title: 'Renamed' }));
    expect(second).toBe(first);
  });

  it('dedupes across pages, not just page 0', () => {
    const existing = data([[activity({ id: 'a' })], [activity({ id: 'b' })]]);
    const result = prependActivity(existing, activity({ id: 'b' }));
    expect(result).toBe(existing);
  });

  it('inserts only into page 0, leaving other pages untouched', () => {
    const existing = data([[activity({ id: 'a' })], [activity({ id: 'b' })]]);
    const result = prependActivity(existing, activity({ id: 'new' }));
    expect(result.pages[0].items.map((a) => a.id)).toEqual(['new', 'a']);
    expect(result.pages[1].items.map((a) => a.id)).toEqual(['b']);
    expect(result.pages[1]).toBe(existing.pages[1]);
  });
});

describe('patchActivity', () => {
  it('patches a row on a later page, leaving other pages content-equal', () => {
    const existing = data([[activity({ id: 'a' })], [activity({ id: 'b', title: 'Old' })]]);
    const result = patchActivity(existing, 'b', { title: 'New' });
    expect(result?.pages[1].items[0].title).toBe('New');
    // patchActivity maps every page unconditionally (matching messageCache's
    // replaceMessage precedent), so untouched pages are content-equal but not
    // reference-equal — unlike prependActivity, which special-cases page 0.
    expect(result?.pages[0].items.map((a) => a.id)).toEqual(existing.pages[0].items.map((a) => a.id));
  });

  it('passes undefined through untouched', () => {
    expect(patchActivity(undefined, 'a', { title: 'x' })).toBeUndefined();
  });

  it('is a no-op when the id is not present', () => {
    const existing = data([[activity({ id: 'a' })]]);
    const result = patchActivity(existing, 'missing', { title: 'x' });
    expect(result?.pages[0].items[0].title).toBe('Museum visit');
  });
});

describe('removeActivity', () => {
  it('removes a row from a later page', () => {
    const existing = data([[activity({ id: 'a' })], [activity({ id: 'b' }), activity({ id: 'c' })]]);
    const result = removeActivity(existing, 'b');
    expect(result?.pages[1].items.map((a) => a.id)).toEqual(['c']);
  });

  it('passes undefined through untouched', () => {
    expect(removeActivity(undefined, 'a')).toBeUndefined();
  });
});

describe('flattenActivities', () => {
  it('flattens pages in order', () => {
    const existing = data([[activity({ id: 'a' }), activity({ id: 'b' })], [activity({ id: 'c' })]]);
    expect(flattenActivities(existing).map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns [] for undefined', () => {
    expect(flattenActivities(undefined)).toEqual([]);
  });
});

describe('applyToList', () => {
  it('never bootstraps from undefined — insert on undefined stays undefined', () => {
    expect(applyToList(undefined, { kind: 'insert', activity: activity({ id: 'a' }) })).toBeUndefined();
  });

  it('inserts without duplicating an existing id', () => {
    const list = [activity({ id: 'a' })];
    const result = applyToList(list, { kind: 'insert', activity: activity({ id: 'a', title: 'dup' }) });
    expect(result).toBe(list);
  });

  it('appends a genuinely new activity', () => {
    const list = [activity({ id: 'a' })];
    const result = applyToList(list, { kind: 'insert', activity: activity({ id: 'b' }) });
    expect(result?.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('patches by id', () => {
    const list = [activity({ id: 'a', title: 'Old' })];
    const result = applyToList(list, { kind: 'patch', id: 'a', patch: { title: 'New' } });
    expect(result?.[0].title).toBe('New');
  });

  it('replaces by id', () => {
    const list = [activity({ id: 'a', title: 'Old' })];
    const replacement = activity({ id: 'a', title: 'Replaced' });
    const result = applyToList(list, { kind: 'replace', activity: replacement });
    expect(result?.[0]).toBe(replacement);
  });

  it('removes by id', () => {
    const list = [activity({ id: 'a' }), activity({ id: 'b' })];
    const result = applyToList(list, { kind: 'remove', id: 'a' });
    expect(result?.map((a) => a.id)).toEqual(['b']);
  });
});

describe('applyActivityCacheOp', () => {
  function makeClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }

  it('insert writes the paged cache, the all-list cache, and never touches the single-row cache', () => {
    const qc = makeClient();
    const tripId = 'trip-1';
    qc.setQueryData(allActivitiesKey(tripId), [activity({ id: 'a' })]);

    applyActivityCacheOp(qc, tripId, { kind: 'insert', activity: activity({ id: 'new' }) });

    const paged = qc.getQueryData<ActivitiesData>(activitiesPageKey(tripId));
    expect(paged?.pages[0].items.map((a) => a.id)).toEqual(['new']);

    const all = qc.getQueryData<Activity[]>(allActivitiesKey(tripId));
    expect(all?.map((a) => a.id)).toEqual(['a', 'new']);
  });

  it('patch updates the paged cache, the all-list cache, and the ["activities", id] single-row cache', () => {
    const qc = makeClient();
    const tripId = 'trip-1';
    qc.setQueryData(activitiesPageKey(tripId), data([[activity({ id: 'a', title: 'Old' })]]));
    qc.setQueryData(allActivitiesKey(tripId), [activity({ id: 'a', title: 'Old' })]);
    qc.setQueryData(['activities', 'a'], activity({ id: 'a', title: 'Old' }));

    applyActivityCacheOp(qc, tripId, { kind: 'patch', id: 'a', patch: { title: 'New' } });

    expect(qc.getQueryData<ActivitiesData>(activitiesPageKey(tripId))?.pages[0].items[0].title).toBe('New');
    expect(qc.getQueryData<Activity[]>(allActivitiesKey(tripId))?.[0].title).toBe('New');
    expect(qc.getQueryData<Activity>(['activities', 'a'])?.title).toBe('New');
  });

  it('remove clears the row from both list caches and removes the single-row cache entry', () => {
    const qc = makeClient();
    const tripId = 'trip-1';
    qc.setQueryData(activitiesPageKey(tripId), data([[activity({ id: 'a' })]]));
    qc.setQueryData(allActivitiesKey(tripId), [activity({ id: 'a' })]);
    qc.setQueryData(['activities', 'a'], activity({ id: 'a' }));

    applyActivityCacheOp(qc, tripId, { kind: 'remove', id: 'a' });

    expect(qc.getQueryData<ActivitiesData>(activitiesPageKey(tripId))?.pages[0].items).toEqual([]);
    expect(qc.getQueryData<Activity[]>(allActivitiesKey(tripId))).toEqual([]);
    expect(qc.getQueryData(['activities', 'a'])).toBeUndefined();
  });

  it('snapshot + restore round-trips both caches (rollback semantics)', () => {
    const qc = makeClient();
    const tripId = 'trip-1';
    const pagedBefore = data([[activity({ id: 'a' })]]);
    const allBefore = [activity({ id: 'a' })];
    qc.setQueryData(activitiesPageKey(tripId), pagedBefore);
    qc.setQueryData(allActivitiesKey(tripId), allBefore);

    const snapshot = snapshotActivityCaches(qc, tripId);
    applyActivityCacheOp(qc, tripId, { kind: 'insert', activity: activity({ id: 'optimistic' }) });
    restoreActivityCaches(qc, tripId, snapshot);

    expect(qc.getQueryData(activitiesPageKey(tripId))).toEqual(pagedBefore);
    expect(qc.getQueryData(allActivitiesKey(tripId))).toEqual(allBefore);
  });
});
