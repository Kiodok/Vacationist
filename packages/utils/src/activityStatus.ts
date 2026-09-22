import { dayjs } from './dayjs';

/**
 * "Is this activity happening / over?" — the FLOATING wall-clock model.
 *
 * An activity's `activity_date` + `start_time`/`end_time` are the digits the organizer typed; they carry
 * no timezone and are shown verbatim everywhere ("14:00–16:00 stays 14:00–16:00 after flying to Porto").
 * So the comparison is against the device's own clock, read as wall-clock digits too: at 14:30 in Porto
 * the 14:00–16:00 activity is under way, exactly as it looked in Germany. There is deliberately no named
 * timezone anywhere in here — that was both a user-facing burden (a manual picker) and unreliable on
 * Hermes (`dayjs.tz` resolves zones through a platform Intl/ICU that differs from V8).
 *
 * `dayjs('YYYY-MM-DDTHH:mm')` parses as LOCAL time, which is precisely "the digits, on this device".
 */

export interface ActivityWhen {
  activity_date: string | null;
  start_time: string | null;
  end_time: string | null;
}

function at(date: string, time: string) {
  return dayjs(`${date}T${time}`);
}

/** Ended already: past its end (a midnight-crossing end rolls to the next day), or 2 h after its start, or its day is over. */
export function isActivityAutoCompleted(activity: ActivityWhen, now = dayjs()): boolean {
  const { activity_date: date, start_time: startTime, end_time: endTime } = activity;
  if (!date) return false;
  if (endTime) {
    let end = at(date, endTime);
    if (startTime && endTime < startTime) end = end.add(1, 'day');
    return now.isAfter(end);
  }
  if (startTime) return now.isAfter(at(date, startTime).add(2, 'hour'));
  return now.isAfter(dayjs(date).endOf('day'));
}

/** Under way right now (an activity with only a start time is treated as lasting 2 h; all-day = its whole day). */
export function isActivityOngoing(activity: ActivityWhen, now = dayjs()): boolean {
  const { activity_date: date, start_time: startTime, end_time: endTime } = activity;
  if (!date) return false;
  if (startTime && endTime) {
    const start = at(date, startTime);
    let end = at(date, endTime);
    if (endTime < startTime) end = end.add(1, 'day');
    return now.isAfter(start) && now.isBefore(end);
  }
  if (startTime) {
    const start = at(date, startTime);
    return now.isAfter(start) && now.isBefore(start.add(2, 'hour'));
  }
  return now.isSame(dayjs(date), 'day');
}

/** The calendar agenda's "highlight as live" rule: today, started, and (when it has an end) not yet ended. */
export function isActivityHappeningNow(activity: ActivityWhen, now = dayjs()): boolean {
  const { activity_date: date, start_time: startTime, end_time: endTime } = activity;
  if (!date || !startTime) return false;
  if (now.format('YYYY-MM-DD') !== date) return false;
  const start = at(date, startTime);
  if (!endTime) return !now.isBefore(start);
  return !now.isBefore(start) && now.isBefore(at(date, endTime));
}
