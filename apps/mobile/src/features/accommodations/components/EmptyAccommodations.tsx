import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyAccommodations() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <Ionicons name="bed-outline" size={48} color={colors.warning} />
      <Text className="text-heading-m text-text-primary text-center">No accommodations yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        Suggest a base to stay and vote on it with your group.
      </Text>
    </View>
  );
}
