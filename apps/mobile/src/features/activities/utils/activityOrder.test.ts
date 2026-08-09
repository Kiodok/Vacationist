import { describe, it, expect } from 'vitest';
import type { Activity } from '@vacationist/types';
import { compareActivitiesForDisplay } from './activityOrder';

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    trip_id: 'trip-1',
    title: 'Activity',
    description: null,
    category: null,
    cost_estimate: null,
    activity_date: null,
    start_time: null,
    end_time: null,
    external_url: null,
    maps_url: null,
    status: 'planned',
    voting_open: true,
    auto_close: false,
    reservation_required: false,
    created_by: 'user-1',
    created_at: '2026-08-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('compareActivitiesForDisplay', () => {
  it('sorts dated activities before undated ones', () => {
    const dated = activity({ id: 'a', activity_date: '2026-08-05' });
    const undated = activity({ id: 'b' });
    expect(compareActivitiesForDisplay(dated, undated)).toBeLessThan(0);
    expect(compareActivitiesForDisplay(undated, dated)).toBeGreaterThan(0);
  });

  it('sorts by date ascending when both are dated', () => {
    const earlier = activity({ id: 'a', activity_date: '2026-08-05' });
    const later = activity({ id: 'b', activity_date: '2026-08-10' });
    expect(compareActivitiesForDisplay(earlier, later)).toBeLessThan(0);
  });

  it('sorts timed activities before all-day activities on the same date', () => {
    const timed = activity({ id: 'a', activity_date: '2026-08-05', start_time: '09:00' });
    const allDay = activity({ id: 'b', activity_date: '2026-08-05' });
    expect(compareActivitiesForDisplay(timed, allDay)).toBeLessThan(0);
  });

  it('sorts by start_time ascending when both are timed on the same date', () => {
    const early = activity({ id: 'a', activity_date: '2026-08-05', start_time: '09:00' });
    const late = activity({ id: 'b', activity_date: '2026-08-05', start_time: '18:00' });
    expect(compareActivitiesForDisplay(early, late)).toBeLessThan(0);
  });

  it('falls back to newest-created-first when date and time are equal', () => {
    const newer = activity({ id: 'a', created_at: '2026-08-01T12:00:00.000Z' });
    const older = activity({ id: 'b', created_at: '2026-08-01T10:00:00.000Z' });
    expect(compareActivitiesForDisplay(newer, older)).toBeLessThan(0);
  });

  it('falls back to id as the final deterministic tiebreaker', () => {
    const a = activity({ id: 'a' });
    const b = activity({ id: 'b' });
    expect(compareActivitiesForDisplay(a, b)).toBeLessThan(0);
    expect(compareActivitiesForDisplay(b, a)).toBeGreaterThan(0);
  });

  it('returns 0 for identical activities', () => {
    const a = activity({ id: 'a' });
    expect(compareActivitiesForDisplay(a, { ...a })).toBe(0);
  });

  it('produces a stable total order regardless of input order (idempotent sort)', () => {
    const items = [
      activity({ id: 'e', activity_date: '2026-08-05', start_time: '18:00' }),
      activity({ id: 'a' }),
      activity({ id: 'c', activity_date: '2026-08-05', start_time: '09:00' }),
      activity({ id: 'd', activity_date: '2026-08-10' }),
      activity({ id: 'b', created_at: '2026-08-01T09:00:00.000Z' }),
    ];
    const sortedOnce = [...items].sort(compareActivitiesForDisplay).map((a) => a.id);
    const sortedTwice = [...sortedOnce.map((id) => items.find((i) => i.id === id)!)]
      .sort(compareActivitiesForDisplay)
      .map((a) => a.id);
    expect(sortedTwice).toEqual(sortedOnce);
  });
});
