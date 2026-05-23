import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';
import { dayjs } from '@vacationist/utils';
import type { SupportedTimezone } from '@vacationist/types';

interface EmptyCalendarDayProps {
  date: string;
  timezone: SupportedTimezone;
}

export function EmptyCalendarDay({ date, timezone }: EmptyCalendarDayProps) {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <Ionicons name="calendar-clear-outline" size={48} color={colors.primary} />
      <Text className="text-heading-m text-text-primary text-center">No activities</Text>
      <Text className="text-body-small text-text-secondary text-center">
        Nothing planned for {dayjs.tz(date, timezone).format('dddd, D MMMM')}
      </Text>
    </View>
  );
}
