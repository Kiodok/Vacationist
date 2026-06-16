import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { Calendar } from 'expo-calendar';
import type { Trip } from '@vacationist/types';
import {
  addTripToCalendar,
  getTripCalendarRecord,
  getWritableCalendars,
  migrateCalendarStorage,
  removeTripFromCalendar,
  requestCalendarPermission,
} from '../utils/calendarSync';

export function useCalendarSync(trip: Trip | undefined) {
  const [isInCalendar, setIsInCalendar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const prevDatesRef = useRef<string>('');

  useEffect(() => {
    if (!trip || Platform.OS === 'web') return;
    setIsInCalendar(!!getTripCalendarRecord(trip.id));
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
    const record = getTripCalendarRecord(trip.id);
    if (!record) return;
    // Silently update the existing calendar event
    addTripToCalendar(trip.id, trip.title, trip.start_date, trip.end_date, record.calendarId);
  }, [trip?.start_date, trip?.end_date]);

  async function openCalendarPicker(): Promise<boolean> {
    if (!trip || Platform.OS === 'web') return false;
    const granted = await requestCalendarPermission();
    if (!granted) return false;
    migrateCalendarStorage();
    setIsLoadingCalendars(true);
    const writable = await getWritableCalendars();
    setCalendars(writable);
    setIsLoadingCalendars(false);
    setIsPickerVisible(true);
    return true;
  }

  function closeCalendarPicker(): void {
    setIsPickerVisible(false);
  }

  async function confirmAddToCalendar(calendarId: string): Promise<boolean> {
    if (!trip) return false;
    setIsLoading(true);
    const success = await addTripToCalendar(
      trip.id,
      trip.title,
      trip.start_date,
      trip.end_date,
      calendarId,
    );
    if (success) {
      setIsInCalendar(true);
      setIsPickerVisible(false);
    }
    setIsLoading(false);
    return success;
  }

  async function removeFromCalendar(): Promise<void> {
    if (!trip) return;
    await removeTripFromCalendar(trip.id);
    setIsInCalendar(false);
  }

  return {
    isInCalendar,
    isLoading,
    isPickerVisible,
    calendars,
    isLoadingCalendars,
    openCalendarPicker,
    closeCalendarPicker,
    confirmAddToCalendar,
    removeFromCalendar,
  };
}
