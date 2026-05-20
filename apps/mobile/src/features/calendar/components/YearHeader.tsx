import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface YearHeaderProps {
  year: number;
  onPrevYear: () => void;
  onNextYear: () => void;
}

export function YearHeader({ year, onPrevYear, onNextYear }: YearHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-md py-sm">
      <Pressable
        onPress={onPrevYear}
        className="p-xs"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="chevron-back" size={24} color="#A0A0A0" />
      </Pressable>

      <Text className="text-heading-l text-text-primary font-semibold">{year}</Text>

      <Pressable
        onPress={onNextYear}
        className="p-xs"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="chevron-forward" size={24} color="#A0A0A0" />
      </Pressable>
    </View>
  );
}
