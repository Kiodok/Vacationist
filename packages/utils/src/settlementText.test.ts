import { describe, it, expect, beforeAll } from 'vitest';
import {
  formatSettlementShareText,
  formatBusinessExpenseSummary,
  buildBusinessExpenseReport,
  mergeCostItemsForReport,
  type BusinessCostItem,
} from './settlementText';
import { initDayjs } from './dayjs';
import type { User } from '@vacationist/types';

beforeAll(() => initDayjs());

const alice: User = { id: 'u1', name: 'Alice', email: null, avatar_url: null, locale: null, timezone: 'UTC', is_guest: false, preferred_currency: null, created_at: '', updated_at: '' };
const bob: User = { id: 'u2', name: 'Bob', email: null, avatar_url: null, locale: null, timezone: 'UTC', is_guest: false, preferred_currency: null, created_at: '', updated_at: '' };
const carol: User = { id: 'u3', name: 'Carol', email: null, avatar_url: null, locale: null, timezone: 'UTC', is_guest: false, preferred_currency: null, created_at: '', updated_at: '' };

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


function makeCostItem(overrides: Partial<BusinessCostItem>): BusinessCostItem {
  return {
    date: '2026-06-01T00:00:00.000Z',
    title: 'Item',
    amount: 100,
    currency: 'EUR',
    paidByOrCreatedBy: 'u1',
    documents: [],
    ...overrides,
  };
}

/** Full pipeline shorthand for the format-layer tests below — merge (same-currency, no rates
 * needed) then build then format, matching exactly what apps/mobile/app/trip/[id]/expenses.tsx
 * does at the call site. */
function summarize(items: BusinessCostItem[], currency: 'EUR' | 'USD', tripTitle: string): string {
  const merged = mergeCostItemsForReport(items, {}, currency);
  const report = buildBusinessExpenseReport({ items: merged, members: memberMap, currency, tripTitle });
  return formatBusinessExpenseSummary(report);
}

describe('formatBusinessExpenseSummary (full pipeline: merge -> build -> format)', () => {
  it('includes every item it is given — is_business filtering is the caller\'s job, not this pipeline\'s', () => {
    // The caller (expenses.tsx) filters to is_business === true across 5 source tables before
    // ever constructing a BusinessCostItem — these pure functions have no concept of that flag.
    const result = summarize(
      [makeCostItem({ title: 'Client dinner', amount: 60, paidByOrCreatedBy: 'u1' })],
      'EUR',
      'Berlin Offsite',
    );

    expect(result).toContain('Client dinner');
    expect(result).toContain('Berlin Offsite');
  });

  it('sums the total and shows the payer name', () => {
    const result = summarize(
      [
        makeCostItem({ title: 'Taxi', amount: 25, paidByOrCreatedBy: 'u1' }),
        makeCostItem({ title: 'Conference ticket', amount: 200, paidByOrCreatedBy: 'u2' }),
      ],
      'EUR',
      'Conf Trip',
    );

    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).toContain('Total (2 expenses)');
    expect(result).toContain('225');
  });

  it('shows a fallback message when there are no items', () => {
    const result = summarize([], 'EUR', 'Family Trip');
    expect(result).toContain('No business expenses recorded.');
  });

  it('renders attached documents as markdown links, and "—" when none', () => {
    const result = summarize(
      [
        makeCostItem({ title: 'Client dinner', amount: 60, paidByOrCreatedBy: 'u1', documents: [{ fileName: 'receipt.pdf', url: 'https://example.com/receipt.pdf' }] }),
        makeCostItem({ title: 'Taxi', amount: 20, paidByOrCreatedBy: 'u1' }),
      ],
      'EUR',
      'Berlin Offsite',
    );

    expect(result).toContain('[receipt.pdf](https://example.com/receipt.pdf)');
    expect(result).toContain('| Taxi | €20.00 | Alice | — |');
  });
});

// v1.34.0 item 9: business-cost flag extended to Base and Transfer (flights/rentals/public
// transport) — each of those now carries its OWN currency (item 12), independent of the trip's
// base_currency, so merging them into one report requires real currency conversion, not just
// string formatting. These tests target mergeCostItemsForReport in isolation (back/forward
// thinking: mixed currencies, same-currency short-circuit, missing rates, rounding).
describe('mergeCostItemsForReport', () => {
  const EUR_USD_RATES = { EUR: 1, USD: 1.1 }; // exchange_rates semantics: value of 1 EUR in `currency`

  it('passes same-currency items through unconverted, without touching the rate map at all', () => {
    const merged = mergeCostItemsForReport([makeCostItem({ amount: 100, currency: 'EUR' })], {}, 'EUR');
    expect(merged).toHaveLength(1);
    expect(merged[0].convertedAmount).toBe(100);
    expect(merged[0].originalAmount).toBe(100);
    expect(merged[0].originalCurrency).toBe('EUR');
  });

  it('converts a differently-currencied item into the report currency, preserving the original for display', () => {
    // A business-flagged flight paid in USD, reported in EUR: 110 USD -> 100 EUR.
    const merged = mergeCostItemsForReport([makeCostItem({ amount: 110, currency: 'USD' })], EUR_USD_RATES, 'EUR');
    expect(merged).toHaveLength(1);
    expect(merged[0].convertedAmount).toBe(100);
    expect(merged[0].originalAmount).toBe(110);
    expect(merged[0].originalCurrency).toBe('USD');
  });

  it('excludes an item entirely when its currency has no rate, rather than coercing it to 0 or throwing', () => {
    const merged = mergeCostItemsForReport(
      [
        makeCostItem({ title: 'Priced normally', amount: 50, currency: 'EUR' }),
        makeCostItem({ title: 'No rate for this one', amount: 50, currency: 'BAM' }),
      ],
      EUR_USD_RATES, // no BAM entry
      'EUR',
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Priced normally');
  });

  it('excludes every item when the report currency itself has no rate entry', () => {
    const merged = mergeCostItemsForReport([makeCostItem({ amount: 50, currency: 'USD' })], { USD: 1.1 }, 'EUR');
    expect(merged).toHaveLength(0);
  });

  it('sums multiple mixed-currency conversions to the expected total (no cent-drift from double rounding)', () => {
    const merged = mergeCostItemsForReport(
      [
        makeCostItem({ amount: 100, currency: 'EUR' }),
        makeCostItem({ amount: 110, currency: 'USD' }), // -> 100 EUR
        makeCostItem({ amount: 55, currency: 'USD' }), // -> 50 EUR
      ],
      EUR_USD_RATES,
      'EUR',
    );
    const total = merged.reduce((sum, m) => sum + m.convertedAmount, 0);
    expect(total).toBe(250);
  });
});

describe('buildBusinessExpenseReport', () => {
  it('shows the converted amount with the original amount parenthesized when currencies differ', () => {
    const merged = mergeCostItemsForReport([makeCostItem({ title: 'Rental car', amount: 110, currency: 'USD', paidByOrCreatedBy: 'u1' })], { EUR: 1, USD: 1.1 }, 'EUR');
    const report = buildBusinessExpenseReport({ items: merged, members: memberMap, currency: 'EUR', tripTitle: 'Trip' });

    expect(report.rows[0].amount).toContain('€100.00');
    expect(report.rows[0].amount).toContain('$110.00');
  });

  it('shows only the converted amount when currencies already match', () => {
    const merged = mergeCostItemsForReport([makeCostItem({ amount: 60, currency: 'EUR' })], {}, 'EUR');
    const report = buildBusinessExpenseReport({ items: merged, members: memberMap, currency: 'EUR', tripTitle: 'Trip' });

    expect(report.rows[0].amount).toBe('€60.00');
  });

  it('total is summed from raw converted amounts, not reconstructed from rounded display strings', () => {
    const merged = mergeCostItemsForReport(
      [makeCostItem({ amount: 33.33, currency: 'EUR' }), makeCostItem({ amount: 33.33, currency: 'EUR' }), makeCostItem({ amount: 33.34, currency: 'EUR' })],
      {},
      'EUR',
    );
    const report = buildBusinessExpenseReport({ items: merged, members: memberMap, currency: 'EUR', tripTitle: 'Trip' });
    expect(report.total).toBe('€100.00');
  });

  it('falls back to "Unknown" for a payer/creator id not present in the members map', () => {
    const merged = mergeCostItemsForReport([makeCostItem({ paidByOrCreatedBy: 'ghost-user' })], {}, 'EUR');
    const report = buildBusinessExpenseReport({ items: merged, members: memberMap, currency: 'EUR', tripTitle: 'Trip' });
    expect(report.rows[0].paidBy).toBe('Unknown');
  });
});
