import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyAccommodations() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-warning-muted items-center justify-center">
        <Ionicons name="bed-outline" size={36} color={colors.warning} />
      </View>
      <Text className="text-heading-m text-text-primary text-center">No accommodations yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        Suggest a base to stay and vote on it with your group.
      </Text>
    </View>
  );
}
