import { useState, useCallback, useMemo } from 'react';
import { dayjs, generateMonthGrid, getActiveMonths } from '@vacationist/utils';
import type { MonthGridData, CalendarView } from '@vacationist/types';

export function useMonthNavigation(
  activityCountByDate: Record<string, number>,
  tripDateSet?: Set<string>,
) {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month());
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [view, setView] = useState<CalendarView>('year');

  const goToPrevMonth = useCallback(() => {
    setMonth((prev) => {
      if (prev === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonth((prev) => {
      if (prev === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = dayjs();
    setYear(now.year());
    setMonth(now.month());
    setSelectedDate(now.format('YYYY-MM-DD'));
    setView('month');
  }, []);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    const d = dayjs(date);
    setYear(d.year());
    setMonth(d.month());
  }, []);

  const goToPrevYear = useCallback(() => {
    setYear((y) => y - 1);
  }, []);

  const goToNextYear = useCallback(() => {
    setYear((y) => y + 1);
  }, []);

  const drillIntoMonth = useCallback((m: number) => {
    setMonth(m);
    setView('month');
    setYear((currentYear) => {
      const now = dayjs();
      if (now.year() === currentYear && now.month() === m) {
        setSelectedDate(now.format('YYYY-MM-DD'));
      } else {
        const firstOfMonth = dayjs().year(currentYear).month(m).date(1);
        setSelectedDate(firstOfMonth.format('YYYY-MM-DD'));
      }
      return currentYear;
    });
  }, []);

  const goBackToYear = useCallback(() => {
    setView('year');
  }, []);

  const activeMonths = useMemo(
    () => getActiveMonths(activityCountByDate),
    [activityCountByDate],
  );

  const monthGrid: MonthGridData = useMemo(
    () => generateMonthGrid(year, month, activityCountByDate, tripDateSet),
    [year, month, activityCountByDate, tripDateSet],
  );

  return {
    year,
    month,
    selectedDate,
    monthGrid,
    view,
    activeMonths,
    selectDate,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    goToPrevYear,
    goToNextYear,
    drillIntoMonth,
    goBackToYear,
  };
}
