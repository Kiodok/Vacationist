import { describe, it, expect, beforeAll } from 'vitest';
import { resolveActiveTrip } from './resolveActiveTrip';
import { initDayjs } from '@vacationist/utils';
import type { Trip } from '@vacationist/types';

beforeAll(() => initDayjs());

function makeTrip(overrides: Partial<Trip>): Trip {
  return {
    id: 't1',
    title: 'Trip',
    description: null,
    start_date: '2020-01-01',
    end_date: '2020-01-02',
    budget_per_person: null,
    base_currency: 'EUR',
    timezone: 'Europe/Berlin',
    status: 'planning',
    created_by: 'u1',
    created_at: '2020-01-01T00:00:00.000Z',
    updated_at: '2020-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('resolveActiveTrip', () => {
  it('returns null when there are no trips', () => {
    expect(resolveActiveTrip([])).toBeNull();
  });

  it('returns null when every trip is archived', () => {
    const trips = [makeTrip({ id: 'a', status: 'archived' }), makeTrip({ id: 'b', status: 'archived' })];
    expect(resolveActiveTrip(trips)).toBeNull();
  });

  it('picks the trip whose date range covers today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const trips = [
      makeTrip({ id: 'past', start_date: '2020-01-01', end_date: '2020-01-02' }),
      makeTrip({ id: 'current', start_date: today, end_date: today }),
      makeTrip({ id: 'future', start_date: '2099-01-01', end_date: '2099-01-02' }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('current');
  });

  it('picks the soonest-ending trip when more than one covers today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const trips = [
      makeTrip({ id: 'long', start_date: today, end_date: '2099-12-31' }),
      makeTrip({ id: 'short', start_date: today, end_date: today }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('short');
  });

  it('excludes archived trips even if their dates cover today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const trips = [
      makeTrip({ id: 'archived-current', start_date: today, end_date: today, status: 'archived' }),
      makeTrip({ id: 'past', start_date: '2020-01-01', end_date: '2020-01-02' }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('past');
  });

  it('falls back to the most recently created non-archived trip when none cover today', () => {
    const trips = [
      makeTrip({ id: 'older', start_date: '2020-01-01', end_date: '2020-01-02', created_at: '2020-01-01T00:00:00.000Z' }),
      makeTrip({ id: 'newer', start_date: '2099-01-01', end_date: '2099-01-02', created_at: '2021-01-01T00:00:00.000Z' }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('newer');
  });
});
