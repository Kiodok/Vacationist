import { dayjs } from '@vacationist/utils';
import type { Trip } from '@vacationist/types';

/**
 * Determines which trip the app-icon "Add Expense" quick action (task 16) should target — there
 * is no other "active/current trip" concept anywhere in the app to reuse. Priority chain:
 *
 *   1. Ongoing — today (device-local date, same bucketing the trips list uses) falls within a
 *      trip's start_date/end_date. Tie-break: the one ending soonest.
 *   2. Upcoming — the next planned trip (start_date in the future). Tie-break: the one starting
 *      soonest.
 *   3. Fallback — the most recently created trip left, covering the "trip just ended, still
 *      settling up" case (a past-dated trip still sitting at `planning` is a valid target here).
 *
 * Only the *stored* `status` is filtered (archived + completed trips are excluded, matching
 * getEffectiveStatus's terminal buckets in TripCard.tsx). The ongoing/upcoming split is purely
 * date-derived — a past-dated trip whose status is still `planning` is not "completed" and stays
 * eligible as a tier-3 fallback.
 *
 * Returns null only when the user has no non-terminal trips at all.
 */
export function resolveActiveTrip(trips: Trip[]): Trip | null {
  const candidates = trips.filter((t) => t.status !== 'archived' && t.status !== 'completed');
  if (candidates.length === 0) return null;

  const today = dayjs().format('YYYY-MM-DD');

  const ongoing = candidates.filter((t) => t.start_date <= today && today <= t.end_date);
  if (ongoing.length > 0) {
    return ongoing.reduce((soonest, t) => (t.end_date < soonest.end_date ? t : soonest));
  }

  const upcoming = candidates.filter((t) => t.start_date > today);
  if (upcoming.length > 0) {
    return upcoming.reduce((soonest, t) => (t.start_date < soonest.start_date ? t : soonest));
  }

  return candidates.reduce((newest, t) => (t.created_at > newest.created_at ? t : newest));
}
