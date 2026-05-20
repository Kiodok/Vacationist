import type { Activity } from './database';
import type { SupportedTimezone } from './enums';

export interface CalendarDay {
  date: string;
  activities: Activity[];
  hasActivities: boolean;
}

export interface TripCalendarData {
  tripId: string;
  timezone: SupportedTimezone;
  dateRange: string[];
  dayMap: Record<string, CalendarDay>;
}

export interface GlobalCalendarTrip {
  trip: { id: string; title: string; start_date: string; end_date: string; timezone: SupportedTimezone };
  activities: Activity[];
}

export interface MonthGridDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasActivities: boolean;
  hasTripCoverage: boolean;
}

export interface MonthGridData {
  year: number;
  month: number;
  label: string;
  weeks: MonthGridDay[][];
}

export type CalendarView = 'year' | 'month';
