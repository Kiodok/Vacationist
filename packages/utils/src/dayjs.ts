import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/de';

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

export function setDayjsLocale(locale: string): void {
  dayjs.locale(locale);
}

// Clamps future timestamps to now so server clock skew never produces "in a few seconds".
export function safeFromNow(dateStr: string): string {
  const d = dayjs(dateStr);
  const now = dayjs();
  return (d.isAfter(now) ? now : d).fromNow();
}

export { dayjs };
