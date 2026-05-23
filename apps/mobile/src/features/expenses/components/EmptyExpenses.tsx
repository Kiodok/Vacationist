import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyExpenses() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-warning-muted items-center justify-center">
        <Ionicons name="wallet-outline" size={36} color={colors.warning} />
      </View>
      <Text className="text-heading-m text-text-primary text-center">No expenses yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        Track shared costs and see who owes what.
      </Text>
    </View>
  );
}
