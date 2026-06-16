import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { storage } from '../../../utils/mmkvStorage';

const CALENDAR_ID_KEY = 'vacationist_calendar_id';
const EVENT_KEY_PREFIX = 'calendar_event_';

function eventKey(tripId: string): string {
  return EVENT_KEY_PREFIX + tripId;
}

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

async function getOrCreateVacationistCalendar(): Promise<string> {
  const stored = storage.getString(CALENDAR_ID_KEY);
  if (stored) {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendars.some((c) => c.id === stored)) return stored;
  }

  const defaultSource =
    Platform.OS === 'ios'
      ? (await Calendar.getDefaultCalendarAsync()).source
      : { isLocalAccount: true, name: 'Vacationist', type: Calendar.CalendarType.LOCAL };

  const id = await Calendar.createCalendarAsync({
    title: 'Vacationist',
    color: '#6C63FF',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: (defaultSource as any)?.id,
    source: defaultSource as any,
    name: 'vacationist',
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  storage.set(CALENDAR_ID_KEY, id);
  return id;
}

export async function addTripToCalendar(
  tripId: string,
  title: string,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  try {
    const granted = await requestCalendarPermission();
    if (!granted) return false;

    const calendarId = await getOrCreateVacationistCalendar();
    const start = new Date(startDate + 'T00:00:00');
    // End date for all-day events should be the next day (exclusive)
    const end = new Date(endDate + 'T00:00:00');
    end.setDate(end.getDate() + 1);

    const existingEventId = storage.getString(eventKey(tripId));
    if (existingEventId) {
      await Calendar.updateEventAsync(existingEventId, {
        title,
        startDate: start,
        endDate: end,
        allDay: true,
      });
    } else {
      const eventId = await Calendar.createEventAsync(calendarId, {
        title,
        startDate: start,
        endDate: end,
        allDay: true,
        notes: 'Added by Vacationist',
      });
      storage.set(eventKey(tripId), eventId);
    }
    return true;
  } catch {
    return false;
  }
}

export async function removeTripFromCalendar(tripId: string): Promise<void> {
  const eventId = storage.getString(eventKey(tripId));
  if (!eventId) return;
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {}
  storage.remove(eventKey(tripId));
}

export function getTripCalendarEventId(tripId: string): string | undefined {
  return storage.getString(eventKey(tripId));
}
