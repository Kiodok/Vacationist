import { describe, it, expect } from 'vitest';
import { computeTripCostSummary, computeBudgetProgress, computeMyCostShares, type CostSummaryRow, type MyCostShareRow } from './costSummary';

function row(source: string, amount: number, currency = 'EUR'): CostSummaryRow {
  return { source, amount, currency };
}

// v1.34.0 items 7/8: the RPC (get_trip_cost_summary) is deliberately "dumb" — all the real
// combination logic (category-level precedence, multi-currency conversion) lives here, so it
// can be exhaustively unit tested. Back-thinking = failure modes visible from today's data;
// forward-thinking = failure modes this must not introduce as the app evolves.
describe('computeTripCostSummary', () => {
  it('returns all-zero totals for an empty trip, never NaN/undefined', () => {
    const result = computeTripCostSummary([], {}, 'EUR');
    expect(result).toEqual({
      total: 0,
      byCategory: { base: 0, transfer: 0, activities: 0, expenses: 0 },
      excludedSourceCount: 0,
    });
  });

  describe('category-level precedence (entity price wins over the matching expense bucket)', () => {
    it('uses the entity sum and ignores the expense bucket when the entity sum is > 0', () => {
      const result = computeTripCostSummary(
        [row('accommodation', 900), row('expense_accommodation', 400)],
        {},
        'EUR',
      );
      // The 400 expense_accommodation must not leak in under any path — this is the exact
      // double-count scenario the precedence rule exists to prevent.
      expect(result.byCategory.base).toBe(900);
      expect(result.total).toBe(900);
    });

    it('falls back to the expense bucket when the entity sum is exactly 0 (no priced/booked entities yet)', () => {
      const result = computeTripCostSummary([row('expense_transport', 250)], {}, 'EUR');
      expect(result.byCategory.transfer).toBe(0);
      expect(result.byCategory.expenses).toBe(250);
      expect(result.total).toBe(250);
    });

    it('sums multiple entity sources within one category before applying precedence (transfer = flights + rentals + public transport)', () => {
      const result = computeTripCostSummary(
        [
          row('transfer_flight', 300),
          row('transfer_rental', 100),
          row('transfer_public_transport', 50),
          row('expense_transport', 999), // must be fully suppressed — transfer entity sum is 450, not 0
        ],
        {},
        'EUR',
      );
      expect(result.byCategory.transfer).toBe(450);
      expect(result.total).toBe(450);
    });

    it("'manual' and 'shopping' expense rows always add, regardless of any other category's entity sum", () => {
      const result = computeTripCostSummary(
        [
          row('accommodation', 900), // base fully priced — its own fallback must not fire
          row('expense_manual', 40),
          row('expense_shopping', 15),
        ],
        {},
        'EUR',
      );
      expect(result.byCategory.expenses).toBe(55);
      expect(result.total).toBe(955);
    });

    it('each category falls back independently — one priced category does not suppress another category\'s fallback', () => {
      const result = computeTripCostSummary(
        [
          row('accommodation', 900), // base priced -> no fallback
          row('expense_transport', 120), // transfer unpriced -> fallback applies
          row('expense_activity', 30), // activities unpriced -> fallback applies
        ],
        {},
        'EUR',
      );
      expect(result.byCategory.base).toBe(900);
      expect(result.byCategory.transfer).toBe(0);
      expect(result.byCategory.activities).toBe(0);
      expect(result.byCategory.expenses).toBe(150);
      expect(result.total).toBe(1050);
    });
  });

  describe('multi-currency conversion', () => {
    const EUR_USD_RATES = { EUR: 1, USD: 1.1 }; // exchange_rates semantics: value of 1 EUR in `currency`

    it('converts a non-base-currency row into baseCurrency before summing', () => {
      // 110 USD -> 100 EUR
      const result = computeTripCostSummary([row('transfer_rental', 110, 'USD')], EUR_USD_RATES, 'EUR');
      expect(result.byCategory.transfer).toBe(100);
    });

    it('does not touch the rate map at all for a row already in baseCurrency (no rounding drift from an unconditional multiply)', () => {
      // An empty rate map would make any conversion throw a lookup miss — proves this path
      // short-circuits before ever consulting `rates`.
      const result = computeTripCostSummary([row('transfer_rental', 100, 'EUR')], {}, 'EUR');
      expect(result.byCategory.transfer).toBe(100);
    });

    it('sums two transfer rows in different currencies correctly', () => {
      // 110 USD -> 100 EUR, plus a 200 EUR rental -> 300 EUR total
      const result = computeTripCostSummary(
        [row('transfer_flight', 110, 'USD'), row('transfer_rental', 200, 'EUR')],
        EUR_USD_RATES,
        'EUR',
      );
      expect(result.byCategory.transfer).toBe(300);
    });

    it('excludes a row whose currency has no rate entry, rather than throwing or coercing it to 0', () => {
      const result = computeTripCostSummary(
        [row('transfer_rental', 100, 'EUR'), row('transfer_flight', 50, 'BAM')],
        EUR_USD_RATES, // no BAM entry
        'EUR',
      );
      expect(result.byCategory.transfer).toBe(100); // the EUR row still counts
      expect(result.excludedSourceCount).toBe(1);
    });

    it('excludes every non-base-currency row when baseCurrency itself has no rate entry', () => {
      const result = computeTripCostSummary([row('transfer_rental', 100, 'USD')], { USD: 1.1 }, 'EUR');
      expect(result.byCategory.transfer).toBe(0);
      expect(result.excludedSourceCount).toBe(1);
    });

    it('sums many small multi-currency rows to the expected total', () => {
      // 7 rows across 3 currencies — a real aggregation, not a single hand-picked pair.
      const rates = { EUR: 1, USD: 1.1, GBP: 0.85 };
      const rows: CostSummaryRow[] = [
        row('transfer_flight', 110, 'USD'), // -> 100
        row('transfer_flight', 55, 'USD'), // -> 50
        row('transfer_rental', 85, 'GBP'), // -> 100
        row('transfer_rental', 42.5, 'GBP'), // -> 50
        row('transfer_public_transport', 20, 'EUR'),
        row('transfer_public_transport', 30, 'EUR'),
        row('transfer_public_transport', 10.5, 'EUR'),
      ];
      const result = computeTripCostSummary(rows, rates, 'EUR');
      expect(result.byCategory.transfer).toBeCloseTo(360.5, 2);
    });
  });

  it('does not crash on an unrecognized source — it converts safely but contributes to no category until this function is updated for it (forward-compat for a future new source)', () => {
    const result = computeTripCostSummary([row('future_source', 100), row('accommodation', 50)], {}, 'EUR');
    expect(result.byCategory.base).toBe(50);
    expect(result.total).toBe(50); // the unrecognized source's amount is simply not counted anywhere
  });

  it('a flight with zero assigned passengers (amount already pre-multiplied to 0 by the RPC) contributes nothing, not NaN', () => {
    const result = computeTripCostSummary([row('transfer_flight', 0)], {}, 'EUR');
    expect(result.byCategory.transfer).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe('computeBudgetProgress', () => {
  it('omits budget comparison entirely when budgetPerPerson is null — never divides by it', () => {
    const result = computeBudgetProgress(500, null, 4);
    expect(result.hasBudget).toBe(false);
    expect(result.perPerson).toBe(125);
    // percent/clampedPercent are defined but must not be trusted by the caller when hasBudget
    // is false — asserting they're inert zeroes, not leftover garbage from a stale calculation.
    expect(result.percent).toBe(0);
    expect(result.clampedPercent).toBe(0);
  });

  it('per-person equals the group total exactly at memberCount = 1 (no rounding artifact from dividing by 1)', () => {
    const result = computeBudgetProgress(742.5, 1000, 1);
    expect(result.perPerson).toBe(742.5);
  });

  it('never divides by zero when memberCount is 0 (defensive — should not occur in practice, the organizer is always a member)', () => {
    const result = computeBudgetProgress(500, 100, 0);
    expect(result.perPerson).toBe(500);
    expect(Number.isFinite(result.perPerson)).toBe(true);
  });

  it('clamps an over-budget percent to 100 for the bar, while the raw percent keeps reading e.g. 134% for display text', () => {
    // total 670, budget 500 (100/person * 5 members) -> 134%
    const result = computeBudgetProgress(670, 100, 5);
    expect(result.percent).toBeCloseTo(134, 5);
    expect(result.clampedPercent).toBe(100);
  });

  it('reports exactly 100% (not 99.999...) when total equals the budget exactly', () => {
    const result = computeBudgetProgress(500, 125, 4);
    expect(result.percent).toBe(100);
    expect(result.clampedPercent).toBe(100);
  });

  it('reports 0% for a trip with no costs yet but a real budget', () => {
    const result = computeBudgetProgress(0, 100, 4);
    expect(result.percent).toBe(0);
    expect(result.clampedPercent).toBe(0);
  });
});

function shareRow(overrides: Partial<MyCostShareRow>): MyCostShareRow {
  return {
    trip_id: 'trip-1',
    trip_title: 'Croatia',
    start_date: '2026-06-01',
    member_count: 4,
    source: 'accommodation',
    currency: 'EUR',
    amount: 100,
    is_my_flight: null,
    ...overrides,
  };
}

// v1.34.0 item 2: the global Analytics tab's per-trip "my share" figure. Back-thinking catch:
// a uniform amount/memberCount split is WRONG for flights specifically (a flight has its own
// passenger list, unrelated to the whole trip's member count) — these tests exist because that
// mistake would have shipped silently (it "looks" reasonable) without them.
describe('computeMyCostShares', () => {
  it('returns nothing for no rows', () => {
    const result = computeMyCostShares([], {}, 'EUR');
    expect(result).toEqual({ trips: [], totalByYear: {}, total: 0, excludedSourceCount: 0 });
  });

  describe('flight passenger gating', () => {
    it('counts the full price_per_person when the caller IS an assigned passenger on that flight', () => {
      const result = computeMyCostShares(
        [shareRow({ source: 'transfer_flight', amount: 250, is_my_flight: true, member_count: 6 })],
        {},
        'EUR',
      );
      // NOT divided by member_count (6) — a flight's price_per_person is already per-person.
      expect(result.trips[0].share).toBe(250);
    });

    it('counts ZERO for a flight the caller is NOT an assigned passenger on — never price_per_person/memberCount either', () => {
      const result = computeMyCostShares(
        [shareRow({ source: 'transfer_flight', amount: 250, is_my_flight: false, member_count: 6 })],
        {},
        'EUR',
      );
      expect(result.trips[0].share).toBe(0);
    });

    it('a trip with two flights charges only the one the caller actually flew', () => {
      const result = computeMyCostShares(
        [
          shareRow({ trip_id: 't1', source: 'transfer_flight', amount: 200, is_my_flight: true }),
          shareRow({ trip_id: 't1', source: 'transfer_flight', amount: 300, is_my_flight: false }),
        ],
        {},
        'EUR',
      );
      expect(result.trips).toHaveLength(1);
      expect(result.trips[0].share).toBe(200);
    });
  });

  describe('even-split categories', () => {
    it('at member_count = 1 (solo trip), the share equals the full amount — no accidental divide-by-1 artifact', () => {
      const result = computeMyCostShares([shareRow({ source: 'accommodation', amount: 742.5, member_count: 1 })], {}, 'EUR');
      expect(result.trips[0].share).toBe(742.5);
    });

    it('divides a non-integer split sensibly (100 / 3), not truncated', () => {
      const result = computeMyCostShares([shareRow({ source: 'accommodation', amount: 100, member_count: 3 })], {}, 'EUR');
      expect(result.trips[0].share).toBeCloseTo(33.333, 2);
    });

    it('sums multiple even-split rows before dividing once by member_count, not per-row', () => {
      // 100 (accommodation) + 40 (rental) + 20 (activity) = 160, / 4 members = 40 each.
      const result = computeMyCostShares(
        [
          shareRow({ source: 'accommodation', amount: 100, member_count: 4 }),
          shareRow({ source: 'transfer_rental', amount: 40, member_count: 4 }),
          shareRow({ source: 'activity', amount: 20, member_count: 4 }),
        ],
        {},
        'EUR',
      );
      expect(result.trips[0].share).toBe(40);
    });
  });

  it('passes expense_owed_by_me through as-is — a debt figure, never re-derived or divided', () => {
    const result = computeMyCostShares([shareRow({ source: 'expense_owed_by_me', amount: 87.5, member_count: 10 })], {}, 'EUR');
    expect(result.trips[0].share).toBe(87.5);
  });

  it('combines flight + expense + even-split contributions correctly in one trip', () => {
    const result = computeMyCostShares(
      [
        shareRow({ source: 'transfer_flight', amount: 150, is_my_flight: true, member_count: 4 }),
        shareRow({ source: 'expense_owed_by_me', amount: 30, member_count: 4 }),
        shareRow({ source: 'accommodation', amount: 200, member_count: 4 }), // -> 50/person
      ],
      {},
      'EUR',
    );
    expect(result.trips[0].share).toBe(150 + 30 + 50);
  });

  describe('year bucketing', () => {
    it('groups by the trip start_date year', () => {
      const result = computeMyCostShares(
        [
          shareRow({ trip_id: 't1', start_date: '2026-06-01', source: 'accommodation', amount: 100, member_count: 1 }),
          shareRow({ trip_id: 't2', start_date: '2027-01-15', source: 'accommodation', amount: 200, member_count: 1 }),
        ],
        {},
        'EUR',
      );
      expect(result.totalByYear).toEqual({ 2026: 100, 2027: 200 });
    });

    it('a trip starting in December buckets to that December\'s year, not the year its (unreturned) end date might fall in', () => {
      const result = computeMyCostShares(
        [shareRow({ trip_id: 't1', start_date: '2026-12-30', source: 'accommodation', amount: 100, member_count: 1 })],
        {},
        'EUR',
      );
      expect(result.trips[0].year).toBe(2026);
    });

    it('two trips in the same year sum into one year bucket', () => {
      const result = computeMyCostShares(
        [
          shareRow({ trip_id: 't1', start_date: '2026-03-01', source: 'accommodation', amount: 100, member_count: 1 }),
          shareRow({ trip_id: 't2', start_date: '2026-09-01', source: 'accommodation', amount: 50, member_count: 1 }),
        ],
        {},
        'EUR',
      );
      expect(result.totalByYear).toEqual({ 2026: 150 });
    });
  });

  it('the grand total equals the sum of every trip\'s share regardless of how many years exist (independent of year-grouping/UI collapse state)', () => {
    const result = computeMyCostShares(
      [
        shareRow({ trip_id: 't1', start_date: '2025-01-01', source: 'accommodation', amount: 100, member_count: 1 }),
        shareRow({ trip_id: 't2', start_date: '2026-01-01', source: 'accommodation', amount: 200, member_count: 1 }),
        shareRow({ trip_id: 't3', start_date: '2027-01-01', source: 'accommodation', amount: 300, member_count: 1 }),
      ],
      {},
      'EUR',
    );
    expect(result.total).toBe(600);
    expect(Object.values(result.totalByYear).reduce((a, b) => a + b, 0)).toBe(600);
  });

  describe('currency conversion', () => {
    it('converts a non-display-currency row before applying even-split division', () => {
      // 110 USD -> 100 EUR, then / 2 members = 50 EUR
      const result = computeMyCostShares(
        [shareRow({ source: 'accommodation', amount: 110, currency: 'USD', member_count: 2 })],
        { EUR: 1, USD: 1.1 },
        'EUR',
      );
      expect(result.trips[0].share).toBe(50);
    });

    it('excludes a row with no rate entry rather than crashing or coercing to 0 silently in the total', () => {
      const result = computeMyCostShares(
        [
          shareRow({ trip_id: 't1', source: 'accommodation', amount: 100, currency: 'EUR', member_count: 1 }),
          shareRow({ trip_id: 't1', source: 'transfer_rental', amount: 50, currency: 'BAM', member_count: 1 }),
        ],
        { EUR: 1 }, // no BAM entry
        'EUR',
      );
      expect(result.trips[0].share).toBe(100); // BAM row silently excluded
      expect(result.excludedSourceCount).toBe(1);
    });
  });

  it('does not crash when displayCurrency has no rate entry at all (e.g. an unset/invalid preferred currency) — every row is safely excluded instead', () => {
    const result = computeMyCostShares([shareRow({ source: 'accommodation', amount: 100, currency: 'USD' })], { USD: 1.1 }, '');
    expect(result.trips[0].share).toBe(0);
    expect(result.excludedSourceCount).toBe(1);
  });
});
