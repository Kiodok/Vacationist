import { describe, it, expect } from 'vitest';
import { computeFlightWinner } from './flightWinner';
import type { TransferFlight, TransferFlightVote } from '@vacationist/types';

function flight(
  id: string,
  direction: TransferFlight['direction'],
  overrides: Partial<TransferFlight> = {},
): TransferFlight {
  return {
    id,
    trip_id: 'trip-1',
    title: 'Test Flight',
    description: null,
    direction,
    airline: null,
    departure_airport: null,
    arrival_airport: null,
    return_departure_airport: null,
    return_arrival_airport: null,
    return_departure_time: null,
    return_arrival_time: null,
    departure_time: null,
    arrival_time: null,
    price_per_person: null,
    external_url: null,
    flight_number: null,
    booking_reference: null,
    notes: null,
    status: 'suggested',
    voting_open: false,
    created_by: 'user-1',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

function vote(
  flightId: string,
  voteType: TransferFlightVote['vote'],
  userId = 'user-1',
): TransferFlightVote {
  return {
    id: `${flightId}-${userId}`,
    trip_id: 'trip-1',
    flight_id: flightId,
    user_id: userId,
    vote: voteType,
    created_at: '2026-01-01T10:00:00Z',
  };
}

describe('computeFlightWinner', () => {
  it('returns null for all directions when flights array is empty', () => {
    expect(computeFlightWinner([], {})).toEqual({
      outbound: null,
      return: null,
      'outbound-return': null,
    });
  });

  it('excludes flights where voting_open is true', () => {
    const f = flight('f1', 'outbound', { voting_open: true });
    expect(computeFlightWinner([f], { f1: [vote('f1', 'must_do')] }).outbound).toBeNull();
  });

  it('excludes soft-deleted flights', () => {
    const f = flight('f1', 'outbound', { deleted_at: '2026-01-02T00:00:00Z' });
    expect(computeFlightWinner([f], { f1: [vote('f1', 'must_do')] }).outbound).toBeNull();
  });

  it('excludes flights that have any group_blocker vote', () => {
    const f = flight('f1', 'outbound');
    const votes = { f1: [vote('f1', 'must_do'), vote('f1', 'group_blocker', 'user-2')] };
    expect(computeFlightWinner([f], votes).outbound).toBeNull();
  });

  it('picks the highest-scoring flight by average vote weight', () => {
    const f1 = flight('f1', 'outbound');
    const f2 = flight('f2', 'outbound');
    const votesByFlightId = {
      f1: [vote('f1', 'skip')],    // avg = 2
      f2: [vote('f2', 'must_do')], // avg = 5
    };
    expect(computeFlightWinner([f1, f2], votesByFlightId).outbound).toBe('f2');
  });

  it('tie-breaks on number of votes (more votes wins)', () => {
    const f1 = flight('f1', 'outbound');
    const f2 = flight('f2', 'outbound');
    // Both average 3 (open), f2 has 2 votes
    const votesByFlightId = {
      f1: [vote('f1', 'open')],
      f2: [vote('f2', 'open'), vote('f2', 'open', 'user-2')],
    };
    expect(computeFlightWinner([f1, f2], votesByFlightId).outbound).toBe('f2');
  });

  it('tie-breaks on created_at when score and vote count are equal (earlier wins)', () => {
    const f1 = flight('f1', 'outbound', { created_at: '2026-01-02T10:00:00Z' });
    const f2 = flight('f2', 'outbound', { created_at: '2026-01-01T10:00:00Z' });
    const votesByFlightId = {
      f1: [vote('f1', 'like')],
      f2: [vote('f2', 'like')],
    };
    expect(computeFlightWinner([f1, f2], votesByFlightId).outbound).toBe('f2');
  });

  it('separates flights by direction correctly', () => {
    const out = flight('out1', 'outbound');
    const ret = flight('ret1', 'return');
    const votesByFlightId = {
      out1: [vote('out1', 'must_do')],
      ret1: [vote('ret1', 'must_do')],
    };
    const result = computeFlightWinner([out, ret], votesByFlightId);
    expect(result.outbound).toBe('out1');
    expect(result.return).toBe('ret1');
    expect(result['outbound-return']).toBeNull();
  });

  it('assigns null for a direction that has no closed flights', () => {
    const f = flight('f1', 'return', { voting_open: true });
    expect(computeFlightWinner([f], { f1: [vote('f1', 'must_do')] }).return).toBeNull();
  });

  it('a flight with no votes scores 0 and loses to one with any vote', () => {
    const f1 = flight('f1', 'outbound'); // no votes → avg 0
    const f2 = flight('f2', 'outbound');
    const votesByFlightId = { f2: [vote('f2', 'open')] }; // avg = 3
    expect(computeFlightWinner([f1, f2], votesByFlightId).outbound).toBe('f2');
  });

  it('handles outbound-return direction as its own segment', () => {
    const f = flight('f1', 'outbound-return');
    const votesByFlightId = { f1: [vote('f1', 'like')] };
    const result = computeFlightWinner([f], votesByFlightId);
    expect(result['outbound-return']).toBe('f1');
    expect(result.outbound).toBeNull();
    expect(result.return).toBeNull();
  });
});
