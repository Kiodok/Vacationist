import { dayjs } from '@vacationist/utils';
import type { Trip } from '@vacationist/types';

/**
 * Determines which trip the app-icon "Add Expense" quick action (task 16) should target — there
 * is no other "active/current trip" concept anywhere in the app to reuse. Mirrors
 * getEffectiveStatus's own bucketing (TripCard.tsx): a trip counts as current when today
 * (device-local date, same as how the trips list already buckets "active" trips) falls within
 * its start_date/end_date. When more than one trip qualifies, the one ending soonest wins; when
 * none do, falls back to the most recently created non-archived trip. Returns null only when the
 * user has no non-archived trips at all.
 */
export function resolveActiveTrip(trips: Trip[]): Trip | null {
  const candidates = trips.filter((t) => t.status !== 'archived');
  if (candidates.length === 0) return null;

  const today = dayjs().format('YYYY-MM-DD');
  const current = candidates.filter((t) => t.start_date <= today && today <= t.end_date);
  if (current.length > 0) {
    return current.reduce((soonest, t) => (t.end_date < soonest.end_date ? t : soonest));
  }

  return candidates.reduce((newest, t) => (t.created_at > newest.created_at ? t : newest));
}
