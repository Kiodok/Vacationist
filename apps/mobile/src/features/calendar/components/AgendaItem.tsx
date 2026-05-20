import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Activity, SupportedTimezone } from '@vacationist/types';
import { formatActivityTime } from '@vacationist/utils';
import { StatusIndicator } from '../../activities/components/StatusIndicator';

interface AgendaItemProps {
  activity: Activity;
  timezone: SupportedTimezone;
  onPress: (activity: Activity) => void;
}

export function AgendaItem({ activity, onPress }: AgendaItemProps) {
  const timeLabel = formatActivityTime(activity.start_time, activity.end_time);

  return (
    <Pressable
      onPress={() => onPress(activity)}
      className="bg-surface border border-border rounded-md p-md flex-row items-center gap-md"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View className="bg-surface-elevated rounded-sm px-sm py-xs min-w-[64px] items-center">
        <Ionicons name="time-outline" size={12} color="#A0A0A0" />
        <Text className="text-body-small text-text-secondary font-medium mt-xs">
          {timeLabel}
        </Text>
      </View>

      <View className="flex-1 gap-xs">
        <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
          {activity.title}
        </Text>
        {activity.category && (
          <Text className="text-body-small text-text-secondary capitalize" numberOfLines={1}>
            {activity.category}
          </Text>
        )}
      </View>

      <StatusIndicator status={activity.status} votingOpen={activity.voting_open} />
    </Pressable>
  );
}
