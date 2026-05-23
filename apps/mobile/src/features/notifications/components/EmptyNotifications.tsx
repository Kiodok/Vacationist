import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyNotifications() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-warning-muted items-center justify-center">
        <Ionicons name="notifications-off-outline" size={36} color={colors.warning} />
      </View>
      <Text className="text-heading-m text-text-primary text-center">No notifications yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        You'll see updates here when things happen in your trips.
      </Text>
    </View>
  );
}
