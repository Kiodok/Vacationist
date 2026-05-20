import { useState, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { generateDateRange } from '@vacationist/utils';
import type { Activity } from '@vacationist/types';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useCalendarActivities } from '../../../src/features/calendar/hooks/useCalendarActivities';
import { useCalendarRealtime } from '../../../src/features/calendar/hooks/useCalendarRealtime';
import { useCalendarNavigation } from '../../../src/features/calendar/hooks/useCalendarNavigation';
import { DayStrip } from '../../../src/features/calendar/components/DayStrip';
import { AgendaList } from '../../../src/features/calendar/components/AgendaList';
import { CalendarActivitySheet } from '../../../src/features/calendar/components/CalendarActivitySheet';

export default function CalendarTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: trip, isLoading: tripLoading } = useTrip(tripId!);
  const { data: activitiesByDate, isLoading: activitiesLoading } = useCalendarActivities(tripId!);
  useCalendarRealtime(tripId!);

  const dateRange = useMemo(
    () => (trip ? generateDateRange(trip.start_date, trip.end_date) : []),
    [trip?.start_date, trip?.end_date],
  );

  const { selectedDate, setSelectedDate } = useCalendarNavigation(dateRange);

  const selectedActivities = useMemo(
    () => activitiesByDate?.[selectedDate] ?? [],
    [activitiesByDate, selectedDate],
  );

  const activityCountByDate = useMemo(() => {
    if (!activitiesByDate) return {};
    const counts: Record<string, number> = {};
    for (const [date, acts] of Object.entries(activitiesByDate)) {
      counts[date] = acts.length;
    }
    return counts;
  }, [activitiesByDate]);

  const [previewActivity, setPreviewActivity] = useState<Activity | null>(null);

  if (tripLoading || activitiesLoading || !trip) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <DayStrip
        dateRange={dateRange}
        timezone={trip.timezone}
        selectedDate={selectedDate}
        activityCountByDate={activityCountByDate}
        onSelectDate={setSelectedDate}
      />
      <AgendaList
        activities={selectedActivities}
        timezone={trip.timezone}
        selectedDate={selectedDate}
        onActivityPress={setPreviewActivity}
      />
      <CalendarActivitySheet
        visible={!!previewActivity}
        onClose={() => setPreviewActivity(null)}
        activity={previewActivity}
        timezone={trip.timezone}
        onViewFullDetails={(activityId) => {
          setPreviewActivity(null);
          router.push({
            pathname: '/trip/[id]',
            params: { id: tripId!, tab: 'Activities', activityId },
          } as never);
        }}
      />
    </View>
  );
}
