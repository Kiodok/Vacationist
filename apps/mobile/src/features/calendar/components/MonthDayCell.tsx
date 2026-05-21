import { Pressable, Text, View } from 'react-native';
import type { MonthGridDay } from '@vacationist/types';

interface MonthDayCellProps {
  day: MonthGridDay;
  isSelected: boolean;
  onPress: (date: string) => void;
}

export function MonthDayCell({ day, isSelected, onPress }: MonthDayCellProps) {
  const textColor = isSelected
    ? 'text-white'
    : day.isCurrentMonth
      ? 'text-text-primary'
      : 'text-text-muted';

  const bgClass = isSelected
    ? 'bg-primary'
    : day.isToday
      ? 'border border-primary'
      : '';

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        onPress={() => onPress(day.date)}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <View className={`w-[36px] h-[36px] rounded-full items-center justify-center ${bgClass}`}>
            <Text className={`text-body font-medium ${textColor}`}>
              {day.dayNumber}
            </Text>
          </View>
          <View
            className={`w-[5px] h-[5px] rounded-full mt-xs ${
              day.hasActivities
                ? isSelected
                  ? 'bg-white'
                  : 'bg-primary'
                : day.hasTripCoverage
                  ? isSelected
                    ? 'bg-white'
                    : 'bg-warning'
                  : 'bg-transparent'
            }`}
          />
        </View>
      </Pressable>
    </View>
  );
}
