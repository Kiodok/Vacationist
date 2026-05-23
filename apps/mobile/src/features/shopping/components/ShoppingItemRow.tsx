import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingItem } from '@vacationist/types';
import { colors } from '@vacationist/ui';

interface ShoppingItemRowProps {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete?: () => void;
  onLongPress?: () => void;
}

export function ShoppingItemRow({ item, onToggle, onDelete, onLongPress }: ShoppingItemRowProps) {
  const isBought = item.status === 'bought';

  const quantityLabel =
    item.quantity != null
      ? item.unit
        ? `${item.quantity} ${item.unit}`
        : `${item.quantity}`
      : item.unit ?? null;

  return (
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
        {isBought && <Ionicons name="checkmark" size={16} color="#0F0F0F" />}
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

      {onDelete && (
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.6 })}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      )}
    </Pressable>
  );
}
