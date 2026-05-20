import { dayjs, initDayjs } from './dayjs';
import type { Activity, TripCalendarData, CalendarDay, MonthGridData, MonthGridDay } from '@vacationist/types';
import type { SupportedTimezone } from '@vacationist/types';

initDayjs();

export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = dayjs(startDate);
  const end = dayjs(endDate);

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }

  return dates;
}

export function groupActivitiesByDate(activities: Activity[]): Record<string, Activity[]> {
  const grouped: Record<string, Activity[]> = {};

  for (const activity of activities) {
    if (!activity.activity_date) continue;
    if (!grouped[activity.activity_date]) {
      grouped[activity.activity_date] = [];
    }
    grouped[activity.activity_date].push(activity);
  }

  return grouped;
}

export function splitDayActivities(activities: Activity[]): { allDay: Activity[]; timed: Activity[] } {
  const allDay: Activity[] = [];
  const timed: Activity[] = [];

  for (const activity of activities) {
    if (activity.start_time) {
      timed.push(activity);
    } else {
      allDay.push(activity);
    }
  }

  return { allDay, timed };
}

export function formatActivityTime(startTime: string | null, endTime: string | null): string {
  if (!startTime) return 'All day';
  const start = startTime.slice(0, 5);
  if (!endTime) return start;
  return `${start} – ${endTime.slice(0, 5)}`;
}

export function buildTripCalendarData(
  trip: { id: string; start_date: string; end_date: string; timezone: SupportedTimezone },
  activities: Activity[],
): TripCalendarData {
  const dateRange = generateDateRange(trip.start_date, trip.end_date);
  const grouped = groupActivitiesByDate(activities);

  const dayMap: Record<string, CalendarDay> = {};
  for (const date of dateRange) {
    const dayActivities = grouped[date] ?? [];
    dayMap[date] = {
      date,
      activities: dayActivities,
      hasActivities: dayActivities.length > 0,
    };
  }

  return {
    tripId: trip.id,
    timezone: trip.timezone,
    dateRange,
    dayMap,
  };
}

export function findTodayOrNextDate(dateRange: string[]): string | null {
  if (dateRange.length === 0) return null;

  const today = dayjs().format('YYYY-MM-DD');

  if (dateRange.includes(today)) return today;

  const nextDate = dateRange.find((d) => d > today);
  if (nextDate) return nextDate;

  return dateRange[0];
}

export function formatCalendarDayHeader(
  date: string,
  timezone: SupportedTimezone,
): { dayName: string; dayNumber: string; monthShort: string; isToday: boolean } {
  const d = dayjs.tz(date, timezone);
  const today = dayjs().tz(timezone).format('YYYY-MM-DD');

  return {
    dayName: d.format('ddd'),
    dayNumber: d.format('D'),
    monthShort: d.format('MMM'),
    isToday: date === today,
  };
}

export function generateMonthGrid(
  year: number,
  month: number,
  activityCountByDate: Record<string, number>,
  tripDateSet?: Set<string>,
): MonthGridData {
  const firstOfMonth = dayjs().year(year).month(month).startOf('month');
  const daysInMonth = firstOfMonth.daysInMonth();
  const startDow = (firstOfMonth.day() + 6) % 7; // Monday=0, Sunday=6
  const today = dayjs().format('YYYY-MM-DD');

  const makeCell = (dateStr: string, dayNumber: number, isCurrentMonth: boolean): MonthGridDay => ({
    date: dateStr,
    dayNumber,
    isCurrentMonth,
    isToday: dateStr === today,
    hasActivities: (activityCountByDate[dateStr] ?? 0) > 0,
    hasTripCoverage: tripDateSet?.has(dateStr) ?? false,
  });

  const allCells: MonthGridDay[] = [];

  const prevMonth = firstOfMonth.subtract(1, 'month');
  const prevDaysInMonth = prevMonth.daysInMonth();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonth.date(prevDaysInMonth - i);
    allCells.push(makeCell(d.format('YYYY-MM-DD'), d.date(), false));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = firstOfMonth.date(day);
    allCells.push(makeCell(d.format('YYYY-MM-DD'), day, true));
  }

  const remaining = 7 - (allCells.length % 7);
  if (remaining < 7) {
    const nextMonth = firstOfMonth.add(1, 'month');
    for (let i = 1; i <= remaining; i++) {
      const d = nextMonth.date(i);
      allCells.push(makeCell(d.format('YYYY-MM-DD'), i, false));
    }
  }

  const weeks: MonthGridDay[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weeks.push(allCells.slice(i, i + 7));
  }

  return {
    year,
    month,
    label: firstOfMonth.format('MMMM YYYY'),
    weeks,
  };
}

export function getActiveMonths(activityCountByDate: Record<string, number>): Set<string> {
  const months = new Set<string>();
  for (const dateStr of Object.keys(activityCountByDate)) {
    if (activityCountByDate[dateStr] > 0) {
      months.add(dateStr.slice(0, 7));
    }
  }
  return months;
}
