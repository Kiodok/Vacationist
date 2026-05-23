import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

export function EmptyRecipes() {
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <Ionicons name="restaurant-outline" size={48} color={colors.warning} />
      <Text className="text-heading-m text-text-primary text-center">No recipes yet</Text>
      <Text className="text-body-small text-text-secondary text-center">
        Add a recipe and push its ingredients straight to a shopping list.
      </Text>
    </View>
  );
}
