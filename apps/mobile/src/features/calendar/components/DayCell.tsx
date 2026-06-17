import { Pressable, Text, View } from 'react-native';
import { formatCalendarDayHeader } from '@vacationist/utils';
import type { SupportedTimezone } from '@vacationist/types';
import { colors, useResolvedTheme } from '@vacationist/ui';

interface DayCellProps {
  date: string;
  timezone: SupportedTimezone;
  isSelected: boolean;
  hasActivities: boolean;
  onPress: (date: string) => void;
}

export function DayCell({ date, timezone, isSelected, hasActivities, onPress }: DayCellProps) {
  const { dayName, dayNumber, isToday } = formatCalendarDayHeader(date, timezone);
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const selectedTextColor = isColorful ? colors.surface : '#FFFFFF';

  return (
    <Pressable
      onPress={() => onPress(date)}
      className={`items-center justify-center w-[52px] py-sm rounded-md ${
        isSelected
          ? 'bg-primary'
          : isToday
            ? 'border border-primary bg-surface'
            : 'bg-surface'
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Text
        className={`text-label font-medium ${isSelected ? '' : 'text-text-muted'}`}
        style={isSelected ? { color: selectedTextColor } : undefined}
      >
        {dayName}
      </Text>
      <Text
        className={`text-heading-m font-bold ${isSelected ? '' : 'text-text-primary'}`}
        style={isSelected ? { color: selectedTextColor } : undefined}
      >
        {dayNumber}
      </Text>
      <View
        className={`w-[5px] h-[5px] rounded-full mt-xs ${
          hasActivities && !isSelected ? 'bg-primary' : 'bg-transparent'
        }`}
        style={hasActivities && isSelected ? { backgroundColor: selectedTextColor } : undefined}
      />
    </Pressable>
  );
}
