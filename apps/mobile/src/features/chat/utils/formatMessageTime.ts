import { dayjs } from '@vacationist/utils';

/**
 * Absolute timestamps for chat messages (no relative "x minutes ago"
 * ticking): same day → time only, same year → day + time, else full date.
 */
export function formatMessageTime(iso: string, now: string | Date = new Date()): string {
  const date = dayjs(iso);
  const reference = dayjs(now);
  if (date.isSame(reference, 'day')) return date.format('HH:mm');
  if (date.isSame(reference, 'year')) return date.format('D MMM HH:mm');
  return date.format('D MMM YYYY HH:mm');
}

/** Returns date and time as separate strings so they can be rendered in
 *  parallel (flex-row) without word-wrapping on narrow message bubbles. */
export function formatMessageTimeParts(
  iso: string,
  now: string | Date = new Date(),
): { datePart: string | null; timePart: string } {
  const date = dayjs(iso);
  const reference = dayjs(now);
  if (date.isSame(reference, 'day')) return { datePart: null, timePart: date.format('HH:mm') };
  if (date.isSame(reference, 'year')) return { datePart: date.format('D MMM'), timePart: date.format('HH:mm') };
  return { datePart: date.format('D MMM YYYY'), timePart: date.format('HH:mm') };
}
