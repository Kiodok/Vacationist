import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyNotes() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <Ionicons name="document-text-outline" size={48} color={colors.primary} />
      <Text className="text-heading-m text-text-primary text-center">No notes yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        Jot down anything useful before, during, or after the trip.
      </Text>
    </View>
  );
}
