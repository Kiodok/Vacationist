import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyRentals() {
  return (
    <View className="flex-1 items-center justify-center gap-sm py-xl">
      <Ionicons name="key-outline" size={48} color={colors.warning} />
      <Text className="text-heading-s text-text-secondary">No rental cars yet</Text>
      <Text className="text-body-small text-text-muted text-center px-xl">
        Add rental car booking details for the trip
      </Text>
    </View>
  );
}
