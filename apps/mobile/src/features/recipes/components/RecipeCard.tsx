import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, METADATA_ICON_COLORS } from '@vacationist/ui';

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
  const { t } = useTranslation('recipes');
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
              <Ionicons name="people-outline" size={14} color={METADATA_ICON_COLORS.people.color} />
              <Text className="text-body-small text-text-secondary">
                {t('card.servings', { count: servings })}
              </Text>
            </View>
            <View className="flex-row items-center gap-xs">
              <Ionicons name="list-outline" size={14} color={METADATA_ICON_COLORS.list.color} />
              <Text className="text-body-small text-text-secondary">
                {t('card.ingredients', { count: ingredientCount })}
              </Text>
            </View>
            {shoppingListNames.length > 0 && (
              <View className="flex-row items-center gap-xs">
                <Ionicons name="cart" size={14} color={colors.primary} />
                <Text className="text-body-small text-primary" numberOfLines={1}>
                  {shoppingListNames.join(', ')}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={METADATA_ICON_COLORS.chevron.color} />
      </View>
    </Pressable>
  );
}
