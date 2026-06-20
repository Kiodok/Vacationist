import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type { PackingItem } from '@vacationist/types';
import { SEEDED_CATEGORY_I18N } from '../utils/categoryUtils';

interface PackingItemRowProps {
  item: PackingItem;
  onToggle: () => void;
  onLongPress: () => void;
}

export function PackingItemRow({ item, onToggle, onLongPress }: PackingItemRowProps) {
  const { t } = useTranslation('stuff');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const isPacked = item.is_packed;
  const categoryKey = SEEDED_CATEGORY_I18N[item.category];
  const categoryLabel = categoryKey ? t(categoryKey) : item.category;

  return (
    <Pressable
      onLongPress={onLongPress}
      className="flex-row items-center gap-md px-md py-sm"
    >
      {/* Checkbox — only this area triggers the packed toggle */}
      <Pressable onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 12 }}>
        <View
          className={`w-[24px] h-[24px] rounded-sm border-2 items-center justify-center ${
            isPacked ? 'bg-success border-success' : 'border-border'
          }`}
          style={isColorful && !isPacked ? { borderColor: colors.surface } : undefined}
        >
          {isPacked && <ThemedIcon name="checkmark" size={16} color={isColorful ? colors.surface : '#FFFFFF'} />}
        </View>
      </Pressable>

      {/* Text */}
      <View className="flex-1">
        <Text
          className={`text-body ${isPacked ? 'line-through text-text-muted' : 'text-text-primary'}`}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text className="text-label text-text-muted" numberOfLines={1}>
          {categoryLabel}
        </Text>
        {item.notes ? (
          <Text className="text-body-small text-text-muted" numberOfLines={1}>
            {item.notes}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
