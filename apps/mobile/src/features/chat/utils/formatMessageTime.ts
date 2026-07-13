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
