import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function EmptyFlights() {
  return (
    <View className="flex-1 items-center justify-center gap-sm py-xl">
      <Ionicons name="airplane-outline" size={48} color="#5C5C5C" />
      <Text className="text-heading-s text-text-secondary">No flights yet</Text>
      <Text className="text-body-small text-text-muted text-center px-xl">
        Add flight options so the group can vote on the best one
      </Text>
    </View>
  );
}
