import { useMemo } from 'react';
import { dayjs } from '@vacationist/utils';
import { useTrip } from '../../trips/hooks/useTrips';
import { useTripMembers } from '../../trips/hooks/useMembers';
import { useActivities } from '../../activities/hooks/useActivities';
import { useAccommodations } from '../../accommodations/hooks/useAccommodations';

export interface HighlightData {
  tripTitle: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  memberCount: number;
  memberFirstNames: string[];
  topActivities: string[];
  accommodationName: string | null;
}

export function useTripHighlightData(tripId: string): { data: HighlightData | null } {
  const { data: trip } = useTrip(tripId);
  const { data: members = [] } = useTripMembers(tripId);
  const { data: activities = [] } = useActivities(tripId);
  const { data: accommodations = [] } = useAccommodations(tripId);

  const data = useMemo((): HighlightData | null => {
    if (!trip) return null;

    const durationDays = dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day') + 1;
    const memberFirstNames = members.slice(0, 5).map((m) => m.user.name.split(' ')[0]);

    const active = activities
      .filter((a) => !a.deleted_at && (a.status === 'reserved' || a.status === 'planned'))
      .sort((a, b) => {
        if (a.status === 'reserved' && b.status !== 'reserved') return -1;
        if (a.status !== 'reserved' && b.status === 'reserved') return 1;
        if (a.activity_date && b.activity_date) {
          if (a.activity_date < b.activity_date) return -1;
          if (a.activity_date > b.activity_date) return 1;
        }
        return 0;
      });
    const topActivities = active.slice(0, 5).map((a) => a.title);

    const bookedAccommodation = accommodations.find(
      (a) => !a.deleted_at && (a.status === 'booked' || a.status === 'reserved'),
    );

    return {
      tripTitle: trip.title,
      startDate: trip.start_date,
      endDate: trip.end_date,
      durationDays,
      memberCount: members.length,
      memberFirstNames,
      topActivities,
      accommodationName: bookedAccommodation?.title ?? null,
    };
  }, [trip, members, activities, accommodations]);

  return { data };
}
