import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { Trip } from '@vacationist/types';
import {
  addTripToCalendar,
  getTripCalendarEventId,
} from '../utils/calendarSync';

export function useCalendarSync(trip: Trip | undefined) {
  const [isInCalendar, setIsInCalendar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const prevDatesRef = useRef<string>('');

  useEffect(() => {
    if (!trip || Platform.OS === 'web') return;
    setIsInCalendar(!!getTripCalendarEventId(trip.id));
  }, [trip?.id]);

  // Auto-update calendar event when trip dates change
  useEffect(() => {
    if (!trip || Platform.OS === 'web') return;
    const datesKey = `${trip.start_date}_${trip.end_date}`;
    if (prevDatesRef.current === '' || prevDatesRef.current === datesKey) {
      prevDatesRef.current = datesKey;
      return;
    }
    prevDatesRef.current = datesKey;
    const hasEvent = !!getTripCalendarEventId(trip.id);
    if (!hasEvent) return;
    // Silently update the existing calendar event
    addTripToCalendar(trip.id, trip.title, trip.start_date, trip.end_date);
  }, [trip?.start_date, trip?.end_date]);

  async function addToCalendar(): Promise<boolean> {
    if (!trip || Platform.OS === 'web') return false;
    setIsLoading(true);
    const success = await addTripToCalendar(trip.id, trip.title, trip.start_date, trip.end_date);
    if (success) setIsInCalendar(true);
    setIsLoading(false);
    return success;
  }

  return { isInCalendar, isLoading, addToCalendar };
}
