import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MonthHeaderProps {
  label: string;
  showTodayButton: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTodayPress: () => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export function MonthHeader({
  label,
  showTodayButton,
  onPrevMonth,
  onNextMonth,
  onTodayPress,
  showBackButton,
  onBackPress,
}: MonthHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-md py-sm">
      <View className="flex-row items-center gap-xs">
        {showBackButton ? (
          <Pressable
            onPress={onBackPress}
            className="p-xs"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="arrow-back" size={22} color="#A0A0A0" />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onPrevMonth}
          className="p-xs"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="chevron-back" size={24} color="#A0A0A0" />
        </Pressable>
      </View>

      <Text className="text-heading-m text-text-primary font-semibold">{label}</Text>

      <View className="flex-row items-center gap-sm">
        <Pressable
          onPress={onNextMonth}
          className="p-xs"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="chevron-forward" size={24} color="#A0A0A0" />
        </Pressable>

        {showTodayButton ? (
          <Pressable
            onPress={onTodayPress}
            className="bg-primary/10 rounded-full px-sm py-xs"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className="text-label text-primary font-medium">Today</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
