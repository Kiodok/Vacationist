import * as Calendar from 'expo-calendar';
import { storage } from '../../../utils/mmkvStorage';

const EVENT_KEY_PREFIX = 'calendar_event_';
const LEGACY_CALENDAR_ID_KEY = 'vacationist_calendar_id';

interface CalendarEventRecord {
  eventId: string;
  calendarId: string;
}

function eventKey(tripId: string): string {
  return EVENT_KEY_PREFIX + tripId;
}

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export async function getWritableCalendars(): Promise<Calendar.Calendar[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.filter((c) => c.allowsModifications);
}

export function migrateCalendarStorage(): void {
  const legacyCalendarId = storage.getString(LEGACY_CALENDAR_ID_KEY);
  if (!legacyCalendarId) return;

  const allKeys = storage.getAllKeys();
  for (const key of allKeys) {
    if (!key.startsWith(EVENT_KEY_PREFIX)) continue;
    const value = storage.getString(key);
    if (!value) continue;
    try {
      JSON.parse(value);
      // Already JSON — no migration needed for this key
    } catch {
      // Plain string (legacy format) — wrap into new format
      const record: CalendarEventRecord = { eventId: value, calendarId: legacyCalendarId };
      storage.set(key, JSON.stringify(record));
    }
  }

  storage.remove(LEGACY_CALENDAR_ID_KEY);
}

export function getTripCalendarRecord(tripId: string): CalendarEventRecord | undefined {
  const value = storage.getString(eventKey(tripId));
  if (!value) return undefined;
  try {
    return JSON.parse(value) as CalendarEventRecord;
  } catch {
    // Legacy plain-string format — treat as eventId with unknown calendarId
    return { eventId: value, calendarId: '' };
  }
}

export async function addTripToCalendar(
  tripId: string,
  title: string,
  startDate: string,
  endDate: string,
  calendarId: string,
): Promise<boolean> {
  try {
    const granted = await requestCalendarPermission();
    if (!granted) return false;

    const start = new Date(startDate + 'T00:00:00Z');
    // End date for all-day events must be exclusive (next day)
    const end = new Date(endDate + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + 1);

    const existing = getTripCalendarRecord(tripId);

    if (existing?.eventId) {
      if (!existing.calendarId || existing.calendarId === calendarId) {
        // Same calendar — update in place
        await Calendar.updateEventAsync(existing.eventId, {
          title,
          startDate: start,
          endDate: end,
          allDay: true,
        });
        storage.set(eventKey(tripId), JSON.stringify({ eventId: existing.eventId, calendarId }));
        return true;
      }
      // Moving to a different calendar — create new first, then remove old
      const newEventId = await Calendar.createEventAsync(calendarId, {
        title,
        startDate: start,
        endDate: end,
        allDay: true,
        notes: 'Added by Vacationist',
      });
      storage.set(eventKey(tripId), JSON.stringify({ eventId: newEventId, calendarId }));
      try {
        await Calendar.deleteEventAsync(existing.eventId);
      } catch {}
      return true;
    }

    const eventId = await Calendar.createEventAsync(calendarId, {
      title,
      startDate: start,
      endDate: end,
      allDay: true,
      notes: 'Added by Vacationist',
    });
    storage.set(eventKey(tripId), JSON.stringify({ eventId, calendarId }));
    return true;
  } catch {
    return false;
  }
}

export async function removeTripFromCalendar(tripId: string): Promise<void> {
  const record = getTripCalendarRecord(tripId);
  if (!record) return;
  try {
    await Calendar.deleteEventAsync(record.eventId);
  } catch {}
  storage.remove(eventKey(tripId));
}
