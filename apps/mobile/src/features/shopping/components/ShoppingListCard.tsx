import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors , ThemedIcon } from '@vacationist/ui';

interface ShoppingListCardProps {
  title: string;
  itemCount: number;
  boughtCount: number;
  onPress: () => void;
  onLongPress?: () => void;
}

export function ShoppingListCard({ title, itemCount, boughtCount, onPress, onLongPress }: ShoppingListCardProps) {
  const { t } = useTranslation('shopping');
  const progress = itemCount > 0 ? boughtCount / itemCount : 0;
  const allDone = itemCount > 0 && boughtCount === itemCount;

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
          <Text className="text-body-small text-text-secondary mt-xs">
            {itemCount === 0
              ? t('card.noItems')
              : allDone
                ? t('card.allDone')
                : t('card.progress', { bought: boughtCount, total: itemCount })}
          </Text>
        </View>
        <ThemedIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      {itemCount > 0 && (
        <View className="mt-sm h-[4px] rounded-full bg-border overflow-hidden">
          <View
            className={`h-full rounded-full ${allDone ? 'bg-primary' : 'bg-success'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </View>
      )}
    </Pressable>
  );
}
