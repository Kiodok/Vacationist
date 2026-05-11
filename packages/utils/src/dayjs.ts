import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';

let initialized = false;

export function initDayjs(): void {
  if (initialized) return;
  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(duration);
  dayjs.extend(relativeTime);
  dayjs.extend(localizedFormat);
  initialized = true;
}

export { dayjs };
