import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyRentals() {
  return (
    <View className="flex-1 items-center justify-center gap-sm py-xl">
      <View className="w-[72px] h-[72px] rounded-full bg-warning-muted items-center justify-center">
        <Ionicons name="key-outline" size={32} color={colors.warning} />
      </View>
      <Text className="text-heading-s text-text-secondary">No rental cars yet</Text>
      <Text className="text-body-small text-text-muted text-center px-xl">
        Add rental car booking details for the trip
      </Text>
    </View>
  );
}
