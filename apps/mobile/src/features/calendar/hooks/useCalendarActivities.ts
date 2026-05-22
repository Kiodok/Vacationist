import { useQuery } from '@tanstack/react-query';
import { getActivities } from '@vacationist/api';
import type { Activity } from '@vacationist/types';
import { groupActivitiesByDate } from '@vacationist/utils';

export function useCalendarActivities(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'activities'],
    queryFn: () => getActivities(tripId),
    select: (data: Activity[]): Record<string, Activity[]> => {
      const scheduled = data.filter((a) => a.activity_date !== null);
      return groupActivitiesByDate(scheduled);
    },
    retry: 2,
    enabled: !!tripId,
  });
}
