// Web stub — expo-calendar is not supported on web.
// Metro resolves calendarSync.native.ts on Android/iOS automatically.

export async function requestCalendarPermission(): Promise<boolean> {
  return false;
}

export async function addTripToCalendar(
  _tripId: string,
  _title: string,
  _startDate: string,
  _endDate: string,
): Promise<boolean> {
  return false;
}

export async function removeTripFromCalendar(_tripId: string): Promise<void> {}

export function getTripCalendarEventId(_tripId: string): string | undefined {
  return undefined;
}
