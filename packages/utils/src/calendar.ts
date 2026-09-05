import { dayjs, initDayjs } from './dayjs';
import type { Activity, TripCalendarData, CalendarDay, MonthGridData, MonthGridDay } from '@vacationist/types';
import type { SupportedTimezone } from '@vacationist/types';

initDayjs();

// A bare dayjs(startDate) parse here was a real bug (task 13): startDate/endDate are date-only
// 'YYYY-MM-DD' strings, which parse as UTC midnight — .format() without .tz()/.utc() then
// converts to the device's local timezone first, shifting every date in the returned range back
// a day on any device behind UTC. Since dayMap is later keyed by these (shifted) strings while
// activities stay grouped under their correct (unshifted) activity_date, this silently dropped
// the trip's true last day from the calendar and inserted a bogus day before its true start.
//
// v1.34.0 follow-up: an earlier version of this function accepted an optional `timezone` and
// used `dayjs.tz(dateString, timezone)` to parse it, on the theory that a date-only value should
// be interpreted "in the trip's own timezone". That reintroduced a *different* bug: `.tz()`
// resolves a named IANA zone via the engine's Intl/ICU timezone database, and React Native's
// Hermes engine can resolve that differently (or incorrectly) than a browser/Node's V8 — the
// exact bug this was meant to prevent ("dates band" silently dropping the trip's last day) came
// back, but only on-device (Android/iOS), never on Web and never in this test suite (which only
// ever runs under Node/V8). A date-only value has no time-of-day and no real association with an
// instant, so it never actually needed a named timezone at all — enumerating "every calendar day
// from start to end, inclusive" is pure date arithmetic with no dependency on DST or UTC offset.
// Parsing with dayjs.utc() (fixed, engine-independent UTC math, no timezone database lookup)
// gives the same correct result without the Hermes-dependent failure mode.
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = dayjs.utc(startDate);
  const end = dayjs.utc(endDate);

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

export function formatActivityTime(
  startTime: string | null,
  endTime: string | null,
  allDayLabel = 'All day',
): string {
  if (!startTime) return allDayLabel;
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
  // dayName/dayNumber/monthShort are pure labels of an already-known calendar date — no
  // dependency on a named timezone (see generateDateRange's doc comment for why dayjs.tz() on a
  // date-only value is a Hermes-unreliable dependency this doesn't actually need).
  const d = dayjs.utc(date);
  // isToday is a genuinely different question — "what is today's date from this trip's
  // timezone's point of view" — which really does need to resolve the current instant against a
  // named zone, so it keeps the real .tz() dependency the other three fields no longer have.
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
