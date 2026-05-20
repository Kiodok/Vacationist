import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActivitiesForTrips } from '@vacationist/api';
import type { Activity, GlobalCalendarTrip } from '@vacationist/types';
import { useTrips } from '../../trips/hooks/useTrips';

export function useGlobalCalendarActivities() {
  const { data: trips } = useTrips();

  const tripIds = useMemo(() => (trips?.map((t) => t.id) ?? []).sort(), [trips]);

  return useQuery({
    queryKey: ['global-calendar-activities', ...tripIds],
    queryFn: () => getActivitiesForTrips(tripIds),
    select: (data: Activity[]): GlobalCalendarTrip[] => {
      if (!trips) return [];

      const byTrip: Record<string, Activity[]> = {};
      for (const activity of data) {
        if (!byTrip[activity.trip_id]) byTrip[activity.trip_id] = [];
        byTrip[activity.trip_id].push(activity);
      }

      return trips
        .filter((t) => byTrip[t.id]?.length)
        .map((t) => ({
          trip: {
            id: t.id,
            title: t.title,
            start_date: t.start_date,
            end_date: t.end_date,
            timezone: t.timezone,
          },
          activities: byTrip[t.id],
        }))
        .sort((a, b) => a.trip.start_date.localeCompare(b.trip.start_date));
    },
    retry: 2,
    enabled: tripIds.length > 0,
  });
}
