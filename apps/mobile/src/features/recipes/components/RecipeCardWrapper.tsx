import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Recipe } from '@vacationist/types';
import { RecipeCard } from './RecipeCard';

interface RecipeCardWrapperProps {
  recipe: Recipe & { ingredient_count: number };
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  shoppingListNames: string[];
  onPress: () => void;
  onDelete: () => void;
}

export function RecipeCardWrapper({
  recipe,
  tripId,
  currentUserId,
  role,
  shoppingListNames,
  onPress,
  onDelete,
}: RecipeCardWrapperProps) {
  const { t } = useTranslation('recipes');
  const { t: tCommon } = useTranslation('common');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canDelete = role === 'organizer' || recipe.created_by === currentUserId;

  return (
    <View>
      <RecipeCard
        title={recipe.title}
        description={recipe.description}
        servings={recipe.servings}
        ingredientCount={recipe.ingredient_count}
        shoppingListNames={shoppingListNames}
        onPress={onPress}
        onLongPress={() => { if (canDelete) setConfirmingDelete(true); }}
      />
      {confirmingDelete && (
        <View className="flex-row items-center justify-center gap-sm py-sm">
          <Text className="text-text-secondary text-body-small">{t('confirm.delete')}</Text>
          <Pressable
            onPress={() => { onDelete(); setConfirmingDelete(false); }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor: 'rgba(255, 92, 92, 0.2)',
            })}
          >
            <Text className="text-danger text-body-small font-semibold">{t('confirm.deleteYes')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirmingDelete(false)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
            })}
          >
            <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
