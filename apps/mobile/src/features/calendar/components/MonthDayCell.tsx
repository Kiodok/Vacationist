import { Pressable, Text, View } from 'react-native';
import type { MonthGridDay } from '@vacationist/types';
import { colors, useThemeColors, useResolvedTheme } from '@vacationist/ui';

const TRIP_COVERAGE_DOT = '#f87a6e';

interface MonthDayCellProps {
  day: MonthGridDay;
  isSelected: boolean;
  onPress: (date: string) => void;
}

export function MonthDayCell({ day, isSelected, onPress }: MonthDayCellProps) {
  const tc = useThemeColors();
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';

  const selectedTextColor = isColorful ? colors.surface : '#FFFFFF';

  const textColor = isSelected
    ? null
    : day.isCurrentMonth
      ? 'text-text-primary'
      : 'text-text-muted';

  const bgClass = isSelected
    ? 'bg-primary'
    : day.isToday
      ? 'border border-primary'
      : '';

  const dotColor = day.hasActivities
    ? isSelected ? selectedTextColor : tc.primary
    : day.hasTripCoverage
      ? isSelected ? selectedTextColor : TRIP_COVERAGE_DOT
      : 'transparent';

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        onPress={() => onPress(day.date)}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <View className={`w-[36px] h-[36px] rounded-full items-center justify-center ${bgClass}`}>
            <Text
              className={textColor ? `text-body font-medium ${textColor}` : 'text-body font-medium'}
              style={isSelected ? { color: selectedTextColor } : undefined}
            >
              {day.dayNumber}
            </Text>
          </View>
          <View
            className="w-[5px] h-[5px] rounded-full mt-xs"
            style={{ backgroundColor: dotColor }}
          />
        </View>
      </Pressable>
    </View>
  );
}
