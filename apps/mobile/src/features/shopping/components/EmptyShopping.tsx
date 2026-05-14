import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function EmptyShopping() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <Ionicons name="cart-outline" size={48} color="#5C5C5C" />
      <Text className="text-heading-m text-text-primary text-center">No shopping lists yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        Create a list and add items your group needs.
      </Text>
    </View>
  );
}
