import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { Activity, SupportedTimezone } from '@vacationist/types';
import { AgendaItem } from './AgendaItem';

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
        <Ionicons name="chevron-forward" size={16} color="#A0A0A0" />
      </Pressable>

      {/* Activities */}
      <View className="p-sm gap-sm">
        {activities.map((activity) => (
          <AgendaItem
            key={activity.id}
            activity={activity}
            timezone={trip.timezone}
            onPress={onActivityPress}
          />
        ))}
      </View>
    </View>
  );
}
