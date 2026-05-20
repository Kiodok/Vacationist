import { useState, useEffect } from 'react';
import { findTodayOrNextDate, dayjs } from '@vacationist/utils';

export function useCalendarNavigation(dateRange: string[]) {
  const [selectedDate, setSelectedDate] = useState<string>(
    () => findTodayOrNextDate(dateRange) ?? dateRange[0] ?? dayjs().format('YYYY-MM-DD'),
  );

  useEffect(() => {
    if (dateRange.length === 0) return;
    if (dateRange.includes(selectedDate)) return;
    const best = findTodayOrNextDate(dateRange) ?? dateRange[0];
    if (best) setSelectedDate(best);
  }, [dateRange, selectedDate]);

  const selectedIndex = dateRange.indexOf(selectedDate);

  return { selectedDate, setSelectedDate, selectedIndex };
}
