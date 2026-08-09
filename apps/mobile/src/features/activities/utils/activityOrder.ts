import type { Activity } from '@vacationist/types';

/**
 * Total order for displaying activities within a section: dated before
 * undated, earliest date first, timed before all-day within a day, earliest
 * time first, then newest-created first, then id as a final deterministic
 * tiebreaker.
 *
 * Needed because the paged activities-tab feed (getActivitiesPage) orders by
 * created_at DESC server-side for stable pagination — NOT display order — so
 * display order must be re-derived entirely client-side rather than relying
 * on (or merely refining) server order the way the old flat query allowed.
 */
export function compareActivitiesForDisplay(a: Activity, b: Activity): number {
  if (!!a.activity_date !== !!b.activity_date) return a.activity_date ? -1 : 1;
  if (a.activity_date && b.activity_date && a.activity_date !== b.activity_date) {
    return a.activity_date < b.activity_date ? -1 : 1;
  }

  if (!!a.start_time !== !!b.start_time) return a.start_time ? -1 : 1;
  if (a.start_time && b.start_time && a.start_time !== b.start_time) {
    return a.start_time < b.start_time ? -1 : 1;
  }

  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}
