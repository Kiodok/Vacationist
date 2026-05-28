import { useState, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dayjs } from '@vacationist/utils';
import type { Activity, SupportedTimezone, UpdateActivityInput } from '@vacationist/types';
import { useUpdateActivity } from '../../src/features/activities/hooks/useActivities';
import { useActivityVotesBatch } from '../../src/features/activities/hooks/useVotes';
import { EditActivitySheet } from '../../src/features/activities/components/EditActivitySheet';
import { useTrips } from '../../src/features/trips/hooks/useTrips';
import { useGlobalCalendarActivities } from '../../src/features/calendar/hooks/useGlobalCalendarActivities';
import { useMonthNavigation } from '../../src/features/calendar/hooks/useMonthNavigation';
import { MonthGrid } from '../../src/features/calendar/components/MonthGrid';
import { YearGrid } from '../../src/features/calendar/components/YearGrid';
import { CalendarActivitySheet } from '../../src/features/calendar/components/CalendarActivitySheet';
import { GlobalCalendarTripSection } from '../../src/features/calendar/components/GlobalCalendarTripSection';
import { colors } from '@vacationist/ui';

export default function GlobalCalendarScreen() {
  const { t } = useTranslation('calendar');
  const router = useRouter();
  const { data: trips, isLoading: tripsLoading } = useTrips();
  const { data: globalData, isLoading: activitiesLoading } = useGlobalCalendarActivities();

  const tripIds = useMemo(() => (trips?.map((t) => t.id) ?? []), [trips]);

  const allGlobalActivityIds = useMemo(() => {
    if (!globalData) return [];
    return globalData.flatMap((gt) => gt.activities.map((a) => a.id));
  }, [globalData]);
  const { data: allGlobalVotes } = useActivityVotesBatch(allGlobalActivityIds);
  const blockedActivityIds = useMemo(() => {
    if (!allGlobalVotes) return new Set<string>();
    const blocked = new Set<string>();
    for (const v of allGlobalVotes) {
      if (v.vote === 'group_blocker') blocked.add(v.activity_id);
    }
    return blocked;
  }, [allGlobalVotes]);

  const activityCountByDate = useMemo(() => {
    if (!globalData) return {};
    const counts: Record<string, number> = {};
    for (const gt of globalData) {
      for (const a of gt.activities) {
        if (a.activity_date && !blockedActivityIds.has(a.id)) {
          counts[a.activity_date] = (counts[a.activity_date] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [globalData, blockedActivityIds]);

  const { tripDateSet, monthDots } = useMemo(() => {
    const dates = new Set<string>();
    const dots: Record<string, { activity: number; tripOnly: number }> = {};

    if (trips && globalData) {
      const tripActivityMonths = new Map<string, Set<string>>();
      for (const gt of globalData) {
        const actMonths = new Set<string>();
        for (const a of gt.activities) {
          if (a.activity_date && !blockedActivityIds.has(a.id)) {
            actMonths.add(a.activity_date.slice(0, 7));
          }
        }
        tripActivityMonths.set(gt.trip.id, actMonths);
      }

      for (const trip of trips) {
        let current = dayjs(trip.start_date);
        const end = dayjs(trip.end_date);
        while (current.isBefore(end) || current.isSame(end, 'day')) {
          dates.add(current.format('YYYY-MM-DD'));
          current = current.add(1, 'day');
        }
        let monthCursor = dayjs(trip.start_date).startOf('month');
        while (monthCursor.isBefore(end) || monthCursor.isSame(end, 'month')) {
          const monthKey = monthCursor.format('YYYY-MM');
          if (!dots[monthKey]) dots[monthKey] = { activity: 0, tripOnly: 0 };
          const hasAct = tripActivityMonths.get(trip.id)?.has(monthKey) ?? false;
          if (hasAct) {
            dots[monthKey].activity++;
          } else {
            dots[monthKey].tripOnly++;
          }
          monthCursor = monthCursor.add(1, 'month');
        }
      }
    }

    return { tripDateSet: dates, monthDots: dots };
  }, [trips, globalData, blockedActivityIds]);

  const {
    year,
    selectedDate,
    monthGrid,
    view,
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
        activitiesForDate: gt.activities.filter((a) => a.activity_date === selectedDate && !blockedActivityIds.has(a.id)),
      }))
      .filter((gt) => gt.activitiesForDate.length > 0);
  }, [globalData, selectedDate, blockedActivityIds]);

  const [previewActivity, setPreviewActivity] = useState<Activity | null>(null);
  const [previewTimezone, setPreviewTimezone] = useState<SupportedTimezone>('Europe/Berlin');
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingTripDates, setEditingTripDates] = useState<{ start_date: string; end_date: string; trip_id: string } | null>(null);

  const updateActivityMutation = useUpdateActivity(editingTripDates?.trip_id ?? '');

  const handleUpdate = (input: UpdateActivityInput) => {
    if (!editingActivity) return;
    updateActivityMutation.mutate(
      { activityId: editingActivity.id, input },
      { onSuccess: () => { setEditingActivity(null); setEditingTripDates(null); } },
    );
  };

  if (tripsLoading || activitiesLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!trips || trips.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-xl gap-md">
        <View className="w-[80px] h-[80px] rounded-full bg-success-muted items-center justify-center">
          <Ionicons name="calendar-outline" size={36} color={colors.success} />
        </View>
        <Text className="text-heading-m text-text-primary text-center">{t('noTrips.title')}</Text>
        <Text className="text-body-small text-text-secondary text-center">
          {t('noTrips.subtitle')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {view === 'year' ? (
        <YearGrid
          year={year}
          monthDots={monthDots}
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
              <View className="w-[80px] h-[80px] rounded-full bg-success-muted items-center justify-center">
                <Ionicons name="calendar-clear-outline" size={36} color={colors.success} />
              </View>
              <Text className="text-heading-m text-text-primary text-center">{t('noActivities.title')}</Text>
              <Text className="text-body-small text-text-secondary text-center">
                {t('noActivities.subtitle', { date: dayjs(selectedDate).format('dddd, D MMMM') })}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12, ...(Platform.OS === 'web' ? { maxWidth: 600, width: '100%', alignSelf: 'center' } : {}) }}>
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
        onEdit={(act) => {
          const trip = trips?.find((t) => t.id === act.trip_id);
          if (!trip) return;
          setEditingActivity(act);
          setEditingTripDates({ start_date: trip.start_date, end_date: trip.end_date, trip_id: trip.id });
          setPreviewActivity(null);
        }}
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

      {editingActivity && editingTripDates && (
        <EditActivitySheet
          visible={!!editingActivity}
          onClose={() => { setEditingActivity(null); setEditingTripDates(null); }}
          onSubmit={handleUpdate}
          isPending={updateActivityMutation.isPending}
          activity={editingActivity}
          tripStartDate={editingTripDates.start_date}
          tripEndDate={editingTripDates.end_date}
        />
      )}
    </SafeAreaView>
  );
}
