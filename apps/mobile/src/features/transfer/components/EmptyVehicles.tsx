import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function EmptyVehicles() {
  return (
    <View className="flex-1 items-center justify-center gap-sm py-xl">
      <Ionicons name="car-outline" size={48} color="#5C5C5C" />
      <Text className="text-heading-s text-text-secondary">No vehicles yet</Text>
      <Text className="text-body-small text-text-muted text-center px-xl">
        Add a car to note down who is traveling together
      </Text>
    </View>
  );
}
