import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RecipeIngredient } from '@vacationist/types';

interface IngredientRowProps {
  ingredient: RecipeIngredient;
  canEdit: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function IngredientRow({ ingredient, canEdit, onEdit, onDelete }: IngredientRowProps) {
  const quantityLabel =
    ingredient.quantity != null
      ? ingredient.unit
        ? `${ingredient.quantity} ${ingredient.unit}`
        : `${ingredient.quantity}`
      : ingredient.unit ?? null;

  return (
    <View className="flex-row items-center px-md py-sm gap-sm">
      <View className="w-[24px] h-[24px] rounded-full border border-border items-center justify-center">
        <View className="w-[8px] h-[8px] rounded-full bg-primary" />
      </View>

      <View className="flex-1">
        <Text className="text-body text-text-primary" numberOfLines={1}>
          {ingredient.title}
        </Text>
        {quantityLabel && (
          <Text className="text-body-small text-text-secondary">{quantityLabel}</Text>
        )}
      </View>

      {canEdit && onEdit && (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.6 })}
        >
          <Ionicons name="pencil-outline" size={16} color="#A0A0A0" />
        </Pressable>
      )}

      {canEdit && onDelete && (
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.6 })}
        >
          <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
        </Pressable>
      )}
    </View>
  );
}
