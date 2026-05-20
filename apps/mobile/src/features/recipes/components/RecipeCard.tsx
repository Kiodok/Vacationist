import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RecipeCardProps {
  title: string;
  description: string | null;
  servings: number;
  ingredientCount: number;
  shoppingListNames: string[];
  onPress: () => void;
  onLongPress?: () => void;
}

export function RecipeCard({
  title,
  description,
  servings,
  ingredientCount,
  shoppingListNames,
  onPress,
  onLongPress,
}: RecipeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="bg-surface border border-border rounded-md p-md"
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-md">
          <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
            {title}
          </Text>
          {description ? (
            <Text className="text-body-small text-text-secondary mt-xs" numberOfLines={2}>
              {description}
            </Text>
          ) : null}
          <View className="flex-row items-center gap-md mt-xs">
            <View className="flex-row items-center gap-xs">
              <Ionicons name="people-outline" size={14} color="#A0A0A0" />
              <Text className="text-body-small text-text-secondary">
                {servings} serving{servings !== 1 ? 's' : ''}
              </Text>
            </View>
            <View className="flex-row items-center gap-xs">
              <Ionicons name="list-outline" size={14} color="#A0A0A0" />
              <Text className="text-body-small text-text-secondary">
                {ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''}
              </Text>
            </View>
            {shoppingListNames.length > 0 && (
              <View className="flex-row items-center gap-xs">
                <Ionicons name="cart" size={14} color="#6C63FF" />
                <Text className="text-body-small text-primary" numberOfLines={1}>
                  {shoppingListNames.join(', ')}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#A0A0A0" />
      </View>
    </Pressable>
  );
}
