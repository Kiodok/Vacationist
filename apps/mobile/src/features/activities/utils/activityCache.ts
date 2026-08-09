import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { ActivitiesPage } from '@vacationist/api';
import type { Activity } from '@vacationist/types';
import { activitiesPageKey, allActivitiesKey } from './activityKeys';

// Shape of the ['trips', tripId, 'activities'] infinite-query cache: pages
// are created_at DESC, offset-paged (see getActivitiesPage).
export type ActivitiesData = InfiniteData<ActivitiesPage, number>;

function containsId(data: ActivitiesData, id: string): boolean {
  return data.pages.some((page) => page.items.some((item) => item.id === id));
}

/** New activities always belong on page 0 — the feed is created_at DESC. */
export function prependActivity(
  data: ActivitiesData | undefined,
  activity: Activity,
): ActivitiesData {
  // pageParams[0] must match useActivities' initialPageParam (0).
  if (!data || data.pages.length === 0) {
    return { pages: [{ items: [activity], hasMore: false }], pageParams: [0] };
  }
  if (containsId(data, activity.id)) return data;
  const [first, ...rest] = data.pages;
  return { ...data, pages: [{ ...first, items: [activity, ...first.items] }, ...rest] };
}

export function patchActivity(
  data: ActivitiesData | undefined,
  id: string,
  patch: Partial<Activity>,
): ActivitiesData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  };
}

export function removeActivity(
  data: ActivitiesData | undefined,
  id: string,
): ActivitiesData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.filter((a) => a.id !== id) })),
  };
}

export function flattenActivities(data: ActivitiesData | undefined): Activity[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

export type ActivityCacheOp =
  | { kind: 'insert'; activity: Activity }
  | { kind: 'patch'; id: string; patch: Partial<Activity> }
  | { kind: 'replace'; activity: Activity }
  | { kind: 'remove'; id: string };

export interface ActivityCacheSnapshot {
  paged: ActivitiesData | undefined;
  all: Activity[] | undefined;
}

/**
 * Pure array counterpart of the ops above, for the ['…','all'] whole-trip
 * cache. Deliberately does NOT mirror prependActivity's bootstrap-from-
 * undefined branch: a one-element array is indistinguishable from a
 * completed fetch that legitimately found one activity, so bootstrapping
 * from a single optimistic insert would make the calendar/export briefly
 * render a trip with exactly one activity instead of "still loading".
 */
export function applyToList(
  list: Activity[] | undefined,
  op: ActivityCacheOp,
): Activity[] | undefined {
  if (!list) return list;
  switch (op.kind) {
    case 'insert':
      return list.some((a) => a.id === op.activity.id) ? list : [...list, op.activity];
    case 'patch':
      return list.map((a) => (a.id === op.id ? { ...a, ...op.patch } : a));
    case 'replace':
      return list.map((a) => (a.id === op.activity.id ? op.activity : a));
    case 'remove':
      return list.filter((a) => a.id !== op.id);
  }
}

export function snapshotActivityCaches(qc: QueryClient, tripId: string): ActivityCacheSnapshot {
  return {
    paged: qc.getQueryData<ActivitiesData>(activitiesPageKey(tripId)),
    all: qc.getQueryData<Activity[]>(allActivitiesKey(tripId)),
  };
}

export function restoreActivityCaches(
  qc: QueryClient,
  tripId: string,
  snapshot: ActivityCacheSnapshot,
): void {
  qc.setQueryData<ActivitiesData>(activitiesPageKey(tripId), snapshot.paged);
  qc.setQueryData<Activity[]>(allActivitiesKey(tripId), snapshot.all);
}

/**
 * Single write path for every activity cache: the paged feed, the whole-trip
 * 'all' list, and the per-row ['activities', id] entry that useActivity()
 * reads. Centralising this makes it impossible to patch the paged cache and
 * forget the 'all' cache — the failure mode that would otherwise silently
 * regress calendar/export optimistic updates, which today work only because
 * the two caches used to share one key.
 */
export function applyActivityCacheOp(qc: QueryClient, tripId: string, op: ActivityCacheOp): void {
  qc.setQueryData<ActivitiesData>(activitiesPageKey(tripId), (old) => {
    switch (op.kind) {
      case 'insert':
        return prependActivity(old, op.activity);
      case 'patch':
        return patchActivity(old, op.id, op.patch);
      case 'replace':
        return patchActivity(old, op.activity.id, op.activity);
      case 'remove':
        return removeActivity(old, op.id);
    }
  });

  qc.setQueryData<Activity[]>(allActivitiesKey(tripId), (old) => applyToList(old, op));

  if (op.kind === 'patch') {
    qc.setQueryData<Activity>(['activities', op.id], (old) => (old ? { ...old, ...op.patch } : old));
  } else if (op.kind === 'replace') {
    qc.setQueryData<Activity>(['activities', op.activity.id], op.activity);
  } else if (op.kind === 'remove') {
    qc.removeQueries({ queryKey: ['activities', op.id], exact: true });
  }
}
