import { View, useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import type { MonthGridData } from '@vacationist/types';
import { MonthHeader } from './MonthHeader';
import { WeekdayHeader } from './WeekdayHeader';
import { MonthDayCell } from './MonthDayCell';

interface MonthGridProps {
  monthGrid: MonthGridData;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTodayPress: () => void;
  onBackToYear?: () => void;
}

const HORIZONTAL_PADDING = 16;

export function MonthGrid({
  monthGrid,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onTodayPress,
  onBackToYear,
}: MonthGridProps) {
  const { width } = useWindowDimensions();
  const cellSize = (width - HORIZONTAL_PADDING * 2) / 7;

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return monthGrid.year === now.getFullYear() && monthGrid.month === now.getMonth();
  }, [monthGrid.year, monthGrid.month]);

  return (
    <View className="bg-surface border-b border-border pb-sm">
      <MonthHeader
        label={monthGrid.label}
        showTodayButton={!isCurrentMonth}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onTodayPress={onTodayPress}
        showBackButton={!!onBackToYear}
        onBackPress={onBackToYear}
      />
      <View style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
        <WeekdayHeader cellSize={cellSize} />
        {monthGrid.weeks.map((week, weekIdx) => (
          <View key={weekIdx} className="flex-row">
            {week.map((day) => (
              <MonthDayCell
                key={day.date}
                day={day}
                isSelected={day.date === selectedDate}
                cellSize={cellSize}
                onPress={onSelectDate}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
