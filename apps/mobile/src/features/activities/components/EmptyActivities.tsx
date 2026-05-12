import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function EmptyActivities() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <Ionicons name="compass-outline" size={48} color="#5C5C5C" />
      <Text className="text-heading-m text-text-primary text-center">No activities yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        Add activities to plan what your group will do on this trip.
      </Text>
    </View>
  );
}
