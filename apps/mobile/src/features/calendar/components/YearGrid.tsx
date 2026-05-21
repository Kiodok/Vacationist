import { View, Platform } from 'react-native';
import { dayjs } from '@vacationist/utils';
import { YearHeader } from './YearHeader';
import { YearMonthCell } from './YearMonthCell';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HORIZONTAL_PADDING = 16;
const ROWS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];
const MAX_CALENDAR_WIDTH = 600;

export interface MonthDots {
  activity: number;
  tripOnly: number;
}

interface YearGridProps {
  year: number;
  monthDots: Record<string, MonthDots>;
  onPrevYear: () => void;
  onNextYear: () => void;
  onSelectMonth: (monthIndex: number) => void;
}

export function YearGrid({
  year,
  monthDots,
  onPrevYear,
  onNextYear,
  onSelectMonth,
}: YearGridProps) {
  const now = dayjs();
  const currentYear = now.year();
  const currentMonth = now.month();

  return (
    <View
      className="bg-surface border-b border-border pb-md"
      style={Platform.OS === 'web'
        ? { flex: 1, maxWidth: MAX_CALENDAR_WIDTH, width: '100%', alignSelf: 'center' }
        : { flex: 1 }
      }
    >
      <YearHeader year={year} onPrevYear={onPrevYear} onNextYear={onNextYear} />
      <View style={{ flex: 1, paddingHorizontal: HORIZONTAL_PADDING }}>
        {ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flex: 1, flexDirection: 'row' }}>
            {row.map((monthIdx) => {
              const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
              const dots = monthDots[key];
              return (
                <YearMonthCell
                  key={monthIdx}
                  monthIndex={monthIdx}
                  monthLabel={MONTH_LABELS[monthIdx]}
                  activityDots={dots?.activity ?? 0}
                  tripOnlyDots={dots?.tripOnly ?? 0}
                  isCurrentMonth={year === currentYear && monthIdx === currentMonth}
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
