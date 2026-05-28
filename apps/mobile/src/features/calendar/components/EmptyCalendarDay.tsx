import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@vacationist/ui';
import { dayjs } from '@vacationist/utils';
import type { SupportedTimezone } from '@vacationist/types';

interface EmptyCalendarDayProps {
  date: string;
  timezone: SupportedTimezone;
}

export function EmptyCalendarDay({ date, timezone }: EmptyCalendarDayProps) {
  const { t } = useTranslation('calendar');
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-success-muted items-center justify-center">
        <Ionicons name="calendar-clear-outline" size={36} color={colors.success} />
      </View>
      <Text className="text-heading-m text-text-primary text-center">{t('noActivities.title')}</Text>
      <Text className="text-body-small text-text-secondary text-center">
        {t('noActivities.subtitle', { date: dayjs.tz(date, timezone).format('dddd, D MMMM') })}
      </Text>
    </View>
  );
}
