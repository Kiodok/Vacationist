import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Activity, SupportedTimezone } from '@vacationist/types';
import { dayjs, formatActivityTime } from '@vacationist/utils';
import { StatusIndicator } from '../../activities/components/StatusIndicator';
import { colors, METADATA_ICON_COLORS, CATEGORY_ICON_COLORS , ThemedIcon } from '@vacationist/ui';

interface AgendaItemProps {
  activity: Activity;
  timezone: SupportedTimezone;
  onPress: (activity: Activity) => void;
  attendees?: string[];
}

function isActivityOngoing(activity: Activity, timezone: SupportedTimezone): boolean {
  if (!activity.activity_date || !activity.start_time) return false;
  const now = dayjs().tz(timezone);
  if (now.format('YYYY-MM-DD') !== activity.activity_date) return false;
  const todayPrefix = activity.activity_date + 'T';
  const startDt = dayjs.tz(todayPrefix + activity.start_time, timezone);
  if (!activity.end_time) return !now.isBefore(startDt);
  const endDt = dayjs.tz(todayPrefix + activity.end_time, timezone);
  return !now.isBefore(startDt) && now.isBefore(endDt);
}

export function AgendaItem({ activity, timezone, onPress, attendees }: AgendaItemProps) {
  const { t } = useTranslation('calendar');
  const timeLabel = formatActivityTime(activity.start_time, activity.end_time, t('allDay'));
  const [showAttendees, setShowAttendees] = useState(false);
  const categoryIcon = activity.category ? CATEGORY_ICON_COLORS[activity.category] : null;
  const [, setTick] = useState(0);
  const ongoing = isActivityOngoing(activity, timezone);

  // Re-evaluate ongoing status every minute so the border appears/disappears without a manual refresh.
  useEffect(() => {
    if (!activity.activity_date || !activity.start_time) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [activity.activity_date, activity.start_time]);

  return (
    <View
      className="bg-surface rounded-md overflow-hidden"
      style={{ borderWidth: ongoing ? 2 : 1, borderColor: ongoing ? colors.primary : colors.border }}
    >
      <Pressable
        onPress={() => onPress(activity)}
        className="p-md flex-row items-center gap-md"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View className="bg-surface-elevated rounded-sm px-sm py-xs min-w-[64px] items-center">
          <ThemedIcon name="time-outline" size={12} color={METADATA_ICON_COLORS.time.color} />
          <Text className="text-body-small text-text-secondary font-medium mt-xs">
            {timeLabel}
          </Text>
        </View>

        <View className="flex-1 gap-xs">
          <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
            {activity.title}
          </Text>
          {activity.category && (
            <View className="flex-row items-center gap-xs">
              {categoryIcon ? <ThemedIcon name={categoryIcon.icon} size={12} color={categoryIcon.color} /> : null}
              <Text className="text-body-small text-text-secondary capitalize" numberOfLines={1}>
                {activity.category}
              </Text>
            </View>
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
            <ThemedIcon name="people" size={14} color={colors.primary} />
            <Text className="text-primary text-body-small font-medium">
              {t('attendeeCount', { count: attendees.length })}
            </Text>
            <ThemedIcon
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
