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
      balances: [
        { user_id: 'u1', total_paid: 100, total_owed: 50, net_balance: 50 },
        { user_id: 'u2', total_paid: 0, total_owed: 50, net_balance: -50 },
      ],
      settlements: [{ from: 'u2', to: 'u1', amount: 50 }],
      members: memberMap,
      currency: 'EUR',
      tripId: 'trip123',
      tripTitle: 'Croatia 2026',
    });

    expect(result).toContain('Croatia 2026');
    expect(result).toContain('https://web.vacationist.app/trip/trip123?tab=Expenses');
  });

  it('shows positive net for creditor and negative for debtor', () => {
    const result = formatSettlementShareText({
      balances: [
        { user_id: 'u1', total_paid: 120, total_owed: 75, net_balance: 45 },
        { user_id: 'u2', total_paid: 30, total_owed: 75, net_balance: -45 },
      ],
      settlements: [{ from: 'u2', to: 'u1', amount: 45 }],
      members: memberMap,
      currency: 'EUR',
      tripId: 'abc',
      tripTitle: 'Trip',
    });

    expect(result).toContain('Alice: +');
    expect(result).toContain('Bob: -');
    expect(result).toContain('Bob → Alice');
    expect(result).toContain('1 payment to settle all debts');
  });

  it('shows "all settled" when no settlements needed', () => {
    const result = formatSettlementShareText({
      balances: [
        { user_id: 'u1', total_paid: 50, total_owed: 50, net_balance: 0 },
        { user_id: 'u2', total_paid: 50, total_owed: 50, net_balance: 0 },
      ],
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
      balances: [
        { user_id: 'u1', total_paid: 150, total_owed: 50, net_balance: 100 },
        { user_id: 'u2', total_paid: 0, total_owed: 50, net_balance: -50 },
        { user_id: 'u3', total_paid: 0, total_owed: 50, net_balance: -50 },
      ],
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
