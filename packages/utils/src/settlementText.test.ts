import { describe, it, expect, beforeAll } from 'vitest';
import { formatSettlementShareText } from './settlementText';
import { initDayjs } from './dayjs';
import type { User } from '@vacationist/types';

beforeAll(() => initDayjs());

const alice: User = { id: 'u1', name: 'Alice', email: null, avatar_url: null, locale: null, timezone: 'UTC', is_guest: false, created_at: '', updated_at: '' };
const bob: User = { id: 'u2', name: 'Bob', email: null, avatar_url: null, locale: null, timezone: 'UTC', is_guest: false, created_at: '', updated_at: '' };
const carol: User = { id: 'u3', name: 'Carol', email: null, avatar_url: null, locale: null, timezone: 'UTC', is_guest: false, created_at: '', updated_at: '' };

const memberMap = new Map([['u1', alice], ['u2', bob], ['u3', carol]]);

describe('formatSettlementShareText', () => {
  it('includes trip title and link', () => {
    const result = formatSettlementShareText({
      settlements: [{ from: 'u2', to: 'u1', amount: 50 }],
      members: memberMap,
      currency: 'EUR',
      tripId: 'trip123',
      tripTitle: 'Croatia 2026',
    });

    expect(result).toContain('Croatia 2026');
    expect(result).toContain('https://web.vacationist.app/trip/trip123?tab=Expenses');
    expect(result).not.toContain('Member Balances');
  });

  it('shows settlements without balance detail', () => {
    const result = formatSettlementShareText({
      settlements: [{ from: 'u2', to: 'u1', amount: 45 }],
      members: memberMap,
      currency: 'EUR',
      tripId: 'abc',
      tripTitle: 'Trip',
    });

    expect(result).toContain('Bob → Alice');
    expect(result).toContain('1 payment to settle all debts');
    expect(result).not.toContain('Alice: +');
    expect(result).not.toContain('Bob: -');
    expect(result).not.toContain('paid:');
    expect(result).not.toContain('owes:');
  });

  it('shows "all settled" when no settlements needed', () => {
    const result = formatSettlementShareText({
      settlements: [],
      members: memberMap,
      currency: 'USD',
      tripId: 'xyz',
      tripTitle: 'Weekend',
    });

    expect(result).toContain('All settled up! No payments needed.');
    expect(result).not.toContain('payments to settle');
  });

  it('uses plural form for multiple payments', () => {
    const result = formatSettlementShareText({
      settlements: [
        { from: 'u2', to: 'u1', amount: 50 },
        { from: 'u3', to: 'u1', amount: 50 },
      ],
      members: memberMap,
      currency: 'CHF',
      tripId: 'g1',
      tripTitle: 'Alps',
    });

    expect(result).toContain('2 payments to settle all debts');
    expect(result).toContain('Bob → Alice');
    expect(result).toContain('Carol → Alice');
  });
});
