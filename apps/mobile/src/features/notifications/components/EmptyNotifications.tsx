import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function EmptyNotifications() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <Ionicons name="notifications-off-outline" size={48} color="#5C5C5C" />
      <Text className="text-heading-m text-text-primary text-center">No notifications yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        You'll see updates here when things happen in your trips.
      </Text>
    </View>
  );
}
