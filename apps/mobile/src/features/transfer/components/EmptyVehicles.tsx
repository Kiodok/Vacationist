import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyVehicles() {
  return (
    <View className="flex-1 items-center justify-center gap-sm py-xl">
      <View className="w-[72px] h-[72px] rounded-full bg-primary-muted items-center justify-center">
        <Ionicons name="car-outline" size={32} color={colors.primary} />
      </View>
      <Text className="text-heading-s text-text-secondary">No vehicles yet</Text>
      <Text className="text-body-small text-text-muted text-center px-xl">
        Add a car to note down who is traveling together
      </Text>
    </View>
  );
}
