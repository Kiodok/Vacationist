import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTripUnreadCount } from '../hooks/useUnreadCount';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';

interface TripNotificationBellProps {
  tripId: string;
}

export function TripNotificationBell({ tripId }: TripNotificationBellProps) {
  const router = useRouter();
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { data: count = 0 } = useTripUnreadCount(tripId);

  return (
    <Pressable
      onPress={() => router.push(`/trip/${tripId}/notifications` as never)}
      hitSlop={8}
      className="relative"
    >
      <ThemedIcon name="notifications-outline" size={22} color={isColorful ? colors.surface : '#FFFFFF'} />
      {count > 0 && (
        <View className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-danger" />
      )}
    </Pressable>
  );
}
