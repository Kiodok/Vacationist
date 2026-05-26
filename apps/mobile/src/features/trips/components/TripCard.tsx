import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { Trip, TripStatus } from '@vacationist/types';
import { colors } from '@vacationist/ui';
import { StatusBadge } from './StatusBadge';

interface TripCardProps {
  trip: Trip & { member_count: number };
  onPress: () => void;
}

function getEffectiveStatus(trip: Trip): TripStatus {
  if (trip.status === 'archived' || trip.status === 'completed') return trip.status;
  const today = dayjs().format('YYYY-MM-DD');
  if (trip.end_date < today) return 'completed';
  if (trip.start_date <= today) return 'active';
  return trip.status;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  if (start.year() !== end.year()) {
    return `${start.format('D MMM YYYY')} – ${end.format('D MMM YYYY')}`;
  }
  if (start.month() !== end.month()) {
    return `${start.format('D MMM')} – ${end.format('D MMM YYYY')}`;
  }
  return `${start.format('D')} – ${end.format('D MMM YYYY')}`;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface border border-border rounded-md p-md active:opacity-80"
    >
      <View className="flex-row items-center justify-between mb-sm">
        <Text className="text-heading-m text-text-primary flex-1 mr-sm" numberOfLines={1}>
          {trip.title}
        </Text>
        <StatusBadge status={getEffectiveStatus(trip)} />
      </View>

      {trip.description ? (
        <Text className="text-body-small text-text-secondary mb-md" numberOfLines={2}>
          {trip.description}
        </Text>
      ) : null}

      <View className="flex-row items-center gap-lg">
        <View className="flex-row items-center gap-xs">
          <Ionicons name="calendar-outline" size={14} color={colors.success} />
          <Text className="text-body-small text-text-secondary">
            {formatDateRange(trip.start_date, trip.end_date)}
          </Text>
        </View>

        <View className="flex-row items-center gap-xs">
          <Ionicons name="people-outline" size={14} color={colors.primary} />
          <Text className="text-body-small text-text-secondary">
            {trip.member_count}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
