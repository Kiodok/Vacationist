import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

interface ShoppingListCardProps {
  title: string;
  itemCount: number;
  boughtCount: number;
  onPress: () => void;
  onLongPress?: () => void;
}

export function ShoppingListCard({ title, itemCount, boughtCount, onPress, onLongPress }: ShoppingListCardProps) {
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
              ? 'No items'
              : allDone
                ? 'All done!'
                : `${boughtCount}/${itemCount} bought`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
