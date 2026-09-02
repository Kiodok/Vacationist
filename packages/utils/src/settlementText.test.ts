import { describe, it, expect, beforeAll } from 'vitest';
import { formatSettlementShareText, formatBusinessExpenseSummary } from './settlementText';
import { initDayjs } from './dayjs';
import type { User, Expense } from '@vacationist/types';

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

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: 'e1',
    trip_id: 't1',
    related_type: 'manual',
    related_id: null,
    title: 'Expense',
    description: null,
    amount: 100,
    currency: 'EUR',
    exchange_rate: 1,
    converted_amount: 100,
    split_method: 'even',
    paid_by: 'u1',
    created_by: 'u1',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_by: null,
    archived_at: null,
    is_business: false,
    ...overrides,
  };
}

describe('formatBusinessExpenseSummary', () => {
  it('only includes expenses flagged is_business', () => {
    const result = formatBusinessExpenseSummary({
      expenses: [
        makeExpense({ id: 'e1', title: 'Client dinner', converted_amount: 60, is_business: true, paid_by: 'u1' }),
        makeExpense({ id: 'e2', title: 'Souvenirs', converted_amount: 20, is_business: false }),
      ],
      members: memberMap,
      currency: 'EUR',
      tripTitle: 'Berlin Offsite',
    });

    expect(result).toContain('Client dinner');
    expect(result).not.toContain('Souvenirs');
    expect(result).toContain('Berlin Offsite');
  });

  it('sums the total and shows the payer name', () => {
    const result = formatBusinessExpenseSummary({
      expenses: [
        makeExpense({ id: 'e1', title: 'Taxi', converted_amount: 25, is_business: true, paid_by: 'u1' }),
        makeExpense({ id: 'e2', title: 'Conference ticket', converted_amount: 200, is_business: true, paid_by: 'u2' }),
      ],
      members: memberMap,
      currency: 'EUR',
      tripTitle: 'Conf Trip',
    });

    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).toContain('Total (2 expenses)');
    expect(result).toContain('225');
  });

  it('shows a fallback message when there are no business expenses', () => {
    const result = formatBusinessExpenseSummary({
      expenses: [makeExpense({ id: 'e1', title: 'Souvenirs', is_business: false })],
      members: memberMap,
      currency: 'EUR',
      tripTitle: 'Family Trip',
    });

    expect(result).toContain('No business expenses recorded.');
  });

  it('renders attached documents as markdown links, and "—" when none', () => {
    const result = formatBusinessExpenseSummary({
      expenses: [
        makeExpense({ id: 'e1', title: 'Client dinner', converted_amount: 60, is_business: true, paid_by: 'u1' }),
        makeExpense({ id: 'e2', title: 'Taxi', converted_amount: 20, is_business: true, paid_by: 'u1' }),
      ],
      members: memberMap,
      currency: 'EUR',
      tripTitle: 'Berlin Offsite',
      documentsByExpenseId: new Map([
        ['e1', [{ fileName: 'receipt.pdf', url: 'https://example.com/receipt.pdf' }]],
      ]),
    });

    expect(result).toContain('[receipt.pdf](https://example.com/receipt.pdf)');
    expect(result).toContain('| Taxi | €20.00 | Alice | — |');
  });
});
