import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTripUnreadCount } from '../hooks/useUnreadCount';

interface TripNotificationBellProps {
  tripId: string;
}

export function TripNotificationBell({ tripId }: TripNotificationBellProps) {
  const router = useRouter();
  const { data: count = 0 } = useTripUnreadCount(tripId);

  return (
    <Pressable
      onPress={() => router.push(`/trip/${tripId}/notifications` as never)}
      hitSlop={8}
      className="relative"
    >
      <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
      {count > 0 && (
        <View className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-danger" />
      )}
    </Pressable>
  );
}
