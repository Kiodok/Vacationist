import { View, Platform } from 'react-native';
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
const MAX_CALENDAR_WIDTH = 600;

export function MonthGrid({
  monthGrid,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onTodayPress,
  onBackToYear,
}: MonthGridProps) {
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return monthGrid.year === now.getFullYear() && monthGrid.month === now.getMonth();
  }, [monthGrid.year, monthGrid.month]);

  return (
    <View
      className="bg-surface border-b border-border pb-sm"
      style={Platform.OS === 'web' ? { maxWidth: MAX_CALENDAR_WIDTH, width: '100%', alignSelf: 'center' } : undefined}
    >
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
        <WeekdayHeader />
        {monthGrid.weeks.map((week, weekIdx) => (
          <View key={weekIdx} style={{ flexDirection: 'row' }}>
            {week.map((day) => (
              <MonthDayCell
                key={day.date}
                day={day}
                isSelected={day.date === selectedDate}
                onPress={onSelectDate}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
