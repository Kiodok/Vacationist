// Web stub — expo-calendar is not supported on web.
// Metro resolves calendarSync.native.ts on Android/iOS automatically.

export async function requestCalendarPermission(): Promise<boolean> {
  return false;
}

export async function getWritableCalendars(): Promise<never[]> {
  return [];
}

export function migrateCalendarStorage(): void {}

export function getTripCalendarRecord(
  _tripId: string,
): { eventId: string; calendarId: string } | undefined {
  return undefined;
}

export async function addTripToCalendar(
  _tripId: string,
  _title: string,
  _startDate: string,
  _endDate: string,
  _calendarId: string,
): Promise<boolean> {
  return false;
}

export async function removeTripFromCalendar(_tripId: string): Promise<void> {}
