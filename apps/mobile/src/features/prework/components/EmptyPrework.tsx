import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyPrework() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <Ionicons name="options-outline" size={48} color={colors.primary} />
      <Text className="text-heading-m text-text-primary text-center">No preferences yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        Add filters to help the organizer find the perfect place to stay.
      </Text>
    </View>
  );
}
