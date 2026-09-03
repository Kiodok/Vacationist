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

  it('returns null when every trip is archived or completed', () => {
    const trips = [
      makeTrip({ id: 'a', status: 'archived' }),
      makeTrip({ id: 'b', status: 'completed' }),
    ];
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

  it('prefers an ongoing trip over an upcoming one', () => {
    const today = new Date().toISOString().slice(0, 10);
    const trips = [
      makeTrip({ id: 'upcoming', start_date: '2099-01-01', end_date: '2099-01-10' }),
      makeTrip({ id: 'ongoing', start_date: today, end_date: today }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('ongoing');
  });

  it('falls back to the next planned trip when none cover today', () => {
    const trips = [
      makeTrip({ id: 'past', start_date: '2020-01-01', end_date: '2020-01-02' }),
      makeTrip({ id: 'soon', start_date: '2099-01-01', end_date: '2099-01-05' }),
      makeTrip({ id: 'later', start_date: '2099-06-01', end_date: '2099-06-05' }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('soon');
  });

  it('picks the soonest-starting upcoming trip regardless of creation order', () => {
    const trips = [
      makeTrip({
        id: 'later-but-newer',
        start_date: '2099-06-01',
        end_date: '2099-06-05',
        created_at: '2021-01-01T00:00:00.000Z',
      }),
      makeTrip({
        id: 'sooner-but-older',
        start_date: '2099-01-01',
        end_date: '2099-01-05',
        created_at: '2020-01-01T00:00:00.000Z',
      }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('sooner-but-older');
  });

  it('excludes archived trips even if their dates cover today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const trips = [
      makeTrip({ id: 'archived-current', start_date: today, end_date: today, status: 'archived' }),
      makeTrip({ id: 'past', start_date: '2020-01-01', end_date: '2020-01-02' }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('past');
  });

  it('excludes completed trips even if their dates cover today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const trips = [
      makeTrip({ id: 'completed-current', start_date: today, end_date: today, status: 'completed' }),
      makeTrip({ id: 'planning-past', start_date: '2020-01-01', end_date: '2020-01-02' }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('planning-past');
  });

  it('excludes completed trips from the upcoming tier', () => {
    const trips = [
      makeTrip({ id: 'completed-soon', start_date: '2099-01-01', end_date: '2099-01-05', status: 'completed' }),
      makeTrip({ id: 'planning-later', start_date: '2099-06-01', end_date: '2099-06-05' }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('planning-later');
  });

  it('falls back to the most recently created trip when all trips are in the past', () => {
    const trips = [
      makeTrip({ id: 'older', start_date: '2019-01-01', end_date: '2019-01-02', created_at: '2019-01-01T00:00:00.000Z' }),
      makeTrip({ id: 'newer', start_date: '2020-05-01', end_date: '2020-05-02', created_at: '2020-05-01T00:00:00.000Z' }),
    ];
    expect(resolveActiveTrip(trips)?.id).toBe('newer');
  });
});
