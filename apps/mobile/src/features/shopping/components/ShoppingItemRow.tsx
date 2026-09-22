import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ShoppingItem } from '@vacationist/types';
import { colors, ThemedIcon } from '@vacationist/ui';

interface ShoppingItemRowProps {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete?: () => void;
  onLongPress?: () => void;
}

/**
 * Ticking (marking bought) stays a single tap — the tester found that reliable and didn't want it
 * slowed down. Deleting gets an inline confirm step (device-test finding, v1.39.0 round 3: no
 * confirmation was "too risky" for an accidental tap), matching the same pattern already used for
 * deleting a shopping LIST (`ShoppingListCardWrapper`'s `confirmingDelete`, `app/trip/[id]/shopping.tsx`).
 */
export function ShoppingItemRow({ item, onToggle, onDelete, onLongPress }: ShoppingItemRowProps) {
  const { t } = useTranslation('shopping');
  const { t: tCommon } = useTranslation('common');
  const [confirming, setConfirming] = useState(false);
  const isBought = item.status === 'bought';

  const quantityLabel =
    item.quantity != null
      ? item.unit
        ? `${item.quantity} ${item.unit}`
        : `${item.quantity}`
      : item.unit ?? null;

  return (
    <View>
      <Pressable
        onPress={onToggle}
        onLongPress={onLongPress}
        className="flex-row items-center px-md py-sm gap-sm"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View
          className={`w-[24px] h-[24px] rounded-sm border items-center justify-center ${
            isBought ? 'bg-success border-success' : 'border-border'
          }`}
        >
          {isBought && <ThemedIcon name="checkmark" size={16} color="#0F0F0F" />}
        </View>

        <View className="flex-1">
          <Text
            className={`text-body ${isBought ? 'text-text-muted line-through' : 'text-text-primary'}`}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {quantityLabel && (
            <Text className="text-body-small text-text-secondary">{quantityLabel}</Text>
          )}
        </View>

        {onDelete && !confirming && (
          <Pressable
            onPress={() => setConfirming(true)}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.6 })}
          >
            <ThemedIcon name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        )}
      </Pressable>

      {confirming && onDelete && (
        <View className="flex-row items-center justify-end gap-sm px-md pb-sm">
          <Text className="text-text-secondary text-body-small flex-1" numberOfLines={1}>
            {t('confirm.deleteItem')}
          </Text>
          <Pressable
            onPress={() => { onDelete(); setConfirming(false); }}
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
            onPress={() => setConfirming(false)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingHorizontal: 12, paddingVertical: 6 })}
          >
            <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
