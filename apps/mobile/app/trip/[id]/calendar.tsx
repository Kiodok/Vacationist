import { useState, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { generateDateRange } from '@vacationist/utils';
import type { Activity, UpdateActivityInput, Currency } from '@vacationist/types';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers } from '../../../src/features/trips/hooks/useMembers';
import { useActivities, useUpdateActivity } from '../../../src/features/activities/hooks/useActivities';
import { useActivityVotesBatch } from '../../../src/features/activities/hooks/useVotes';
import { useCalendarActivities } from '../../../src/features/calendar/hooks/useCalendarActivities';
import { useCalendarRealtime } from '../../../src/features/calendar/hooks/useCalendarRealtime';
import { useCalendarNavigation } from '../../../src/features/calendar/hooks/useCalendarNavigation';
import { DayStrip } from '../../../src/features/calendar/components/DayStrip';
import { AgendaList } from '../../../src/features/calendar/components/AgendaList';
import { CalendarActivitySheet } from '../../../src/features/calendar/components/CalendarActivitySheet';
import { EditActivitySheet } from '../../../src/features/activities/components/EditActivitySheet';
import { colors } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';

export default function CalendarTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: trip, isLoading: tripLoading } = useTrip(tripId!);
  const { data: activitiesByDate, isLoading: activitiesLoading } = useCalendarActivities(tripId!);
  const { data: allActivities } = useActivities(tripId!);
  useCalendarRealtime(tripId!);

  const allActivityIds = useMemo(() => (allActivities ?? []).map((a) => a.id), [allActivities]);
  const { data: allTripVotes } = useActivityVotesBatch(allActivityIds);
  const blockedActivityIds = useMemo(() => {
    if (!allTripVotes) return new Set<string>();
    const blocked = new Set<string>();
    for (const v of allTripVotes) {
      if (v.vote === 'group_blocker') blocked.add(v.activity_id);
    }
    return blocked;
  }, [allTripVotes]);

  const dateRange = useMemo(
    () => (trip ? generateDateRange(trip.start_date, trip.end_date) : []),
    [trip?.start_date, trip?.end_date],
  );

  const { selectedDate, setSelectedDate } = useCalendarNavigation(dateRange);

  const selectedActivities = useMemo(
    () => (activitiesByDate?.[selectedDate] ?? []).filter((a) => !blockedActivityIds.has(a.id)),
    [activitiesByDate, selectedDate, blockedActivityIds],
  );

  const activityCountByDate = useMemo(() => {
    if (!activitiesByDate) return {};
    const counts: Record<string, number> = {};
    for (const [date, acts] of Object.entries(activitiesByDate)) {
      const count = acts.filter((a) => !blockedActivityIds.has(a.id)).length;
      if (count > 0) counts[date] = count;
    }
    return counts;
  }, [activitiesByDate, blockedActivityIds]);

  const selectedActivityIds = useMemo(
    () => selectedActivities.map((a) => a.id),
    [selectedActivities],
  );
  const { data: batchVotes } = useActivityVotesBatch(selectedActivityIds);
  const { data: members } = useTripMembers(tripId!);

  const attendeesByActivity = useMemo(() => {
    if (!members) return {};
    const result: Record<string, string[]> = {};
    const votesByActivity: Record<string, { user_id: string; vote: string }[]> = {};
    for (const v of batchVotes ?? []) {
      if (!votesByActivity[v.activity_id]) votesByActivity[v.activity_id] = [];
      votesByActivity[v.activity_id].push(v);
    }
    for (const activity of selectedActivities) {
      const actVotes = votesByActivity[activity.id] ?? [];
      const voterIds = new Set(actVotes.map((v) => v.user_id));
      const skipIds = new Set(actVotes.filter((v) => v.vote === 'skip').map((v) => v.user_id));
      result[activity.id] = members
        .filter((m) => voterIds.has(m.user_id) && !skipIds.has(m.user_id))
        .map((m) => m.user.name);
    }
    return result;
  }, [members, batchVotes, selectedActivities]);

  const [previewActivity, setPreviewActivity] = useState<Activity | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const updateActivityMutation = useUpdateActivity();

  const handleUpdate = (input: UpdateActivityInput) => {
    if (!editingActivity) return;
    setEditingActivity(null);
    updateActivityMutation.mutate({ activityId: editingActivity.id, tripId: tripId!, input });
  };

  if (tripLoading || activitiesLoading || !trip) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} size="large" />
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
        attendeesByActivity={attendeesByActivity}
      />
      <CalendarActivitySheet
        visible={!!previewActivity}
        onClose={() => setPreviewActivity(null)}
        activity={previewActivity}
        timezone={trip.timezone}
        onEdit={(act) => {
          setPreviewActivity(null);
          setEditingActivity(act);
        }}
        onViewFullDetails={(activityId) => {
          setPreviewActivity(null);
          router.push({
            pathname: '/trip/[id]',
            params: { id: tripId!, tab: 'Activities', activityId },
          } as never);
        }}
      />

      {editingActivity && (
        <EditActivitySheet
          visible={!!editingActivity}
          onClose={() => setEditingActivity(null)}
          onSubmit={handleUpdate}
          isPending={isMutationBusy(updateActivityMutation)}
          activity={editingActivity}
          currency={(trip.base_currency ?? 'EUR') as Currency}
          tripStartDate={trip.start_date}
          tripEndDate={trip.end_date}
        />
      )}
    </View>
  );
}
