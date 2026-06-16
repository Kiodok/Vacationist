import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { dayjs } from '@vacationist/utils';
import type { Activity, SupportedTimezone } from '@vacationist/types';
import { colors , ThemedIcon } from '@vacationist/ui';
import { AgendaItem } from './AgendaItem';
import { useTripMembers } from '../../trips/hooks/useMembers';
import { useActivityVotesBatch } from '../../activities/hooks/useVotes';

interface GlobalCalendarTripSectionProps {
  trip: { id: string; title: string; start_date: string; end_date: string; timezone: SupportedTimezone };
  activities: Activity[];
  onActivityPress: (activity: Activity) => void;
  onTripPress: (tripId: string) => void;
}

export function GlobalCalendarTripSection({
  trip,
  activities,
  onActivityPress,
  onTripPress,
}: GlobalCalendarTripSectionProps) {
  const activityIds = useMemo(() => activities.map((a) => a.id), [activities]);
  const { data: batchVotes } = useActivityVotesBatch(activityIds);
  const { data: members } = useTripMembers(trip.id);

  const attendeesByActivity = useMemo(() => {
    if (!members) return {};
    const result: Record<string, string[]> = {};
    const votesByActivity: Record<string, { user_id: string; vote: string }[]> = {};
    for (const v of batchVotes ?? []) {
      if (!votesByActivity[v.activity_id]) votesByActivity[v.activity_id] = [];
      votesByActivity[v.activity_id].push(v);
    }
    for (const activity of activities) {
      const actVotes = votesByActivity[activity.id] ?? [];
      const voterIds = new Set(actVotes.map((v) => v.user_id));
      const skipIds = new Set(actVotes.filter((v) => v.vote === 'skip').map((v) => v.user_id));
      result[activity.id] = members
        .filter((m) => voterIds.has(m.user_id) && !skipIds.has(m.user_id))
        .map((m) => m.user.name);
    }
    return result;
  }, [members, batchVotes, activities]);

  return (
    <View className="bg-surface border border-border rounded-md overflow-hidden">
      {/* Trip header */}
      <Pressable
        onPress={() => onTripPress(trip.id)}
        className="flex-row items-center justify-between p-md border-b border-border"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View className="flex-1">
          <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
            {trip.title}
          </Text>
          <Text className="text-body-small text-text-secondary">
            {dayjs(trip.start_date).format('D MMM')} – {dayjs(trip.end_date).format('D MMM YYYY')}
          </Text>
        </View>
        <ThemedIcon name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      {/* Activities */}
      <View className="p-sm gap-sm">
        {activities.map((activity) => (
          <AgendaItem
            key={activity.id}
            activity={activity}
            timezone={trip.timezone}
            onPress={onActivityPress}
            attendees={attendeesByActivity[activity.id]}
          />
        ))}
      </View>
    </View>
  );
}
