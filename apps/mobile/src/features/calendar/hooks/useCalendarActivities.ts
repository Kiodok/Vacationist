import { useQuery } from '@tanstack/react-query';
import { getAllActivities } from '@vacationist/api';
import type { Activity } from '@vacationist/types';
import { groupActivitiesByDate } from '@vacationist/utils';
import { allActivitiesKey } from '../../activities/utils/activityKeys';

// Shares its cache entry with useAllActivities(tripId) — same key, same
// queryFn, one fetch — `select` is per-observer in TanStack Query, so this
// hook's date-grouping never affects what useAllActivities' other consumers
// (export, highlights, search) see, and vice versa. Deliberately NOT the
// paged activities-tab feed: the calendar needs every dated activity, not
// just the first page.
export function useCalendarActivities(tripId: string) {
  return useQuery({
    queryKey: allActivitiesKey(tripId),
    queryFn: () => getAllActivities(tripId),
    select: (data: Activity[]): Record<string, Activity[]> => {
      const scheduled = data.filter((a) => a.activity_date !== null);
      return groupActivitiesByDate(scheduled);
    },
    retry: 2,
    enabled: !!tripId,
  });
}
