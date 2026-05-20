import { View, useWindowDimensions } from 'react-native';
import { dayjs } from '@vacationist/utils';
import { YearHeader } from './YearHeader';
import { YearMonthCell } from './YearMonthCell';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLUMNS = 3;
const HORIZONTAL_PADDING = 16;
const ROWS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];

interface YearGridProps {
  year: number;
  activityMonths: Set<string>;
  tripMonths: Set<string>;
  onPrevYear: () => void;
  onNextYear: () => void;
  onSelectMonth: (monthIndex: number) => void;
}

export function YearGrid({
  year,
  activityMonths,
  tripMonths,
  onPrevYear,
  onNextYear,
  onSelectMonth,
}: YearGridProps) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - HORIZONTAL_PADDING * 2) / COLUMNS;

  const now = dayjs();
  const currentYear = now.year();
  const currentMonth = now.month();

  return (
    <View className="bg-surface border-b border-border pb-md">
      <YearHeader year={year} onPrevYear={onPrevYear} onNextYear={onNextYear} />
      <View style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
        {ROWS.map((row, rowIdx) => (
          <View key={rowIdx} className="flex-row">
            {row.map((monthIdx) => {
              const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
              const hasActivities = activityMonths.has(key);
              const hasTripOnly = !hasActivities && tripMonths.has(key);
              return (
                <YearMonthCell
                  key={monthIdx}
                  monthIndex={monthIdx}
                  monthLabel={MONTH_LABELS[monthIdx]}
                  hasActivities={hasActivities}
                  hasTripOnly={hasTripOnly}
                  isCurrentMonth={year === currentYear && monthIdx === currentMonth}
                  cellWidth={cellWidth}
                  onPress={onSelectMonth}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
