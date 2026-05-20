import { useState, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { Activity, SupportedTimezone } from '@vacationist/types';
import { useTrips } from '../../src/features/trips/hooks/useTrips';
import { useGlobalCalendarActivities } from '../../src/features/calendar/hooks/useGlobalCalendarActivities';
import { useMonthNavigation } from '../../src/features/calendar/hooks/useMonthNavigation';
import { MonthGrid } from '../../src/features/calendar/components/MonthGrid';
import { YearGrid } from '../../src/features/calendar/components/YearGrid';
import { CalendarActivitySheet } from '../../src/features/calendar/components/CalendarActivitySheet';
import { GlobalCalendarTripSection } from '../../src/features/calendar/components/GlobalCalendarTripSection';

export default function GlobalCalendarScreen() {
  const router = useRouter();
  const { data: trips, isLoading: tripsLoading } = useTrips();
  const { data: globalData, isLoading: activitiesLoading } = useGlobalCalendarActivities();

  const activityCountByDate = useMemo(() => {
    if (!globalData) return {};
    const counts: Record<string, number> = {};
    for (const gt of globalData) {
      for (const a of gt.activities) {
        if (a.activity_date) {
          counts[a.activity_date] = (counts[a.activity_date] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [globalData]);

  const { tripDateSet, tripMonths } = useMemo(() => {
    const dates = new Set<string>();
    const months = new Set<string>();
    if (trips) {
      for (const trip of trips) {
        let current = dayjs(trip.start_date);
        const end = dayjs(trip.end_date);
        while (current.isBefore(end) || current.isSame(end, 'day')) {
          dates.add(current.format('YYYY-MM-DD'));
          current = current.add(1, 'day');
        }
        let monthCursor = dayjs(trip.start_date).startOf('month');
        while (monthCursor.isBefore(end) || monthCursor.isSame(end, 'month')) {
          months.add(monthCursor.format('YYYY-MM'));
          monthCursor = monthCursor.add(1, 'month');
        }
      }
    }
    return { tripDateSet: dates, tripMonths: months };
  }, [trips]);

  const {
    year,
    selectedDate,
    monthGrid,
    view,
    activeMonths,
    selectDate,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    goToPrevYear,
    goToNextYear,
    drillIntoMonth,
    goBackToYear,
  } = useMonthNavigation(activityCountByDate, tripDateSet);

  const tripsForSelectedDate = useMemo(() => {
    if (!globalData) return [];
    return globalData
      .map((gt) => ({
        ...gt,
        activitiesForDate: gt.activities.filter((a) => a.activity_date === selectedDate),
      }))
      .filter((gt) => gt.activitiesForDate.length > 0);
  }, [globalData, selectedDate]);

  const [previewActivity, setPreviewActivity] = useState<Activity | null>(null);
  const [previewTimezone, setPreviewTimezone] = useState<SupportedTimezone>('Europe/Berlin');

  if (tripsLoading || activitiesLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </SafeAreaView>
    );
  }

  if (!trips || trips.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-xl gap-md">
        <Ionicons name="calendar-outline" size={48} color="#5C5C5C" />
        <Text className="text-heading-m text-text-primary text-center">No trips yet</Text>
        <Text className="text-body-small text-text-secondary text-center">
          Create a trip to see your activities on the calendar.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {view === 'year' ? (
        <YearGrid
          year={year}
          activityMonths={activeMonths}
          tripMonths={tripMonths}
          onPrevYear={goToPrevYear}
          onNextYear={goToNextYear}
          onSelectMonth={drillIntoMonth}
        />
      ) : (
        <>
          <MonthGrid
            monthGrid={monthGrid}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            onPrevMonth={goToPrevMonth}
            onNextMonth={goToNextMonth}
            onTodayPress={goToToday}
            onBackToYear={goBackToYear}
          />

          {tripsForSelectedDate.length === 0 ? (
            <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
              <Ionicons name="calendar-clear-outline" size={48} color="#5C5C5C" />
              <Text className="text-heading-m text-text-primary text-center">No activities</Text>
              <Text className="text-body-small text-text-secondary text-center">
                Nothing planned for {dayjs(selectedDate).format('dddd, D MMMM')}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {tripsForSelectedDate.map(({ trip, activitiesForDate }) => (
                <GlobalCalendarTripSection
                  key={trip.id}
                  trip={trip}
                  activities={activitiesForDate}
                  onActivityPress={(activity) => {
                    setPreviewActivity(activity);
                    setPreviewTimezone(trip.timezone);
                  }}
                  onTripPress={(tripId) =>
                    router.push({ pathname: '/trip/[id]', params: { id: tripId } } as never)
                  }
                />
              ))}
            </ScrollView>
          )}
        </>
      )}

      <CalendarActivitySheet
        visible={!!previewActivity}
        onClose={() => setPreviewActivity(null)}
        activity={previewActivity}
        timezone={previewTimezone}
        onViewFullDetails={(activityId) => {
          const tripId = previewActivity?.trip_id;
          setPreviewActivity(null);
          if (tripId) {
            router.push({
              pathname: '/trip/[id]',
              params: { id: tripId, tab: 'Activities', activityId },
            } as never);
          }
        }}
      />
    </SafeAreaView>
  );
}
