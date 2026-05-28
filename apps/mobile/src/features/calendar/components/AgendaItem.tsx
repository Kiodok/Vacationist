import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Activity, SupportedTimezone } from '@vacationist/types';
import { formatActivityTime } from '@vacationist/utils';
import { StatusIndicator } from '../../activities/components/StatusIndicator';
import { colors } from '@vacationist/ui';

interface AgendaItemProps {
  activity: Activity;
  timezone: SupportedTimezone;
  onPress: (activity: Activity) => void;
  attendees?: string[];
}

export function AgendaItem({ activity, onPress, attendees }: AgendaItemProps) {
  const { t } = useTranslation('calendar');
  const timeLabel = formatActivityTime(activity.start_time, activity.end_time, t('allDay'));
  const [showAttendees, setShowAttendees] = useState(false);

  return (
    <View className="bg-surface border border-border rounded-md overflow-hidden">
      <Pressable
        onPress={() => onPress(activity)}
        className="p-md flex-row items-center gap-md"
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

      {attendees && attendees.length > 0 && (
        <View className="border-t border-border px-md">
          <Pressable
            onPress={() => setShowAttendees(!showAttendees)}
            className="flex-row items-center gap-xs py-sm"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="people" size={14} color={colors.primary} />
            <Text className="text-primary text-body-small font-medium">
              {t('attendeeCount', { count: attendees.length })}
            </Text>
            <Ionicons
              name={showAttendees ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={colors.primary}
            />
          </Pressable>
          {showAttendees && (
            <View className="flex-row flex-wrap gap-xs pb-sm">
              {attendees.map((name, i) => (
                <View key={i} className="bg-primary/10 rounded-full px-sm py-xs">
                  <Text className="text-primary text-body-small">{name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
