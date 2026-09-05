import type { CostSummaryRow, MyCostShareRow } from '@vacationist/types';
import { convertAmount, type CurrencyRateMap } from './currencyConversion';

export type { CostSummaryRow, MyCostShareRow };

// The RPC (get_trip_cost_summary) is deliberately "dumb": mechanical status/soft-delete
// filtering and per-(source, currency) grouping only. Everything below (category-level
// precedence, currency conversion) is a pure, unit-tested function instead of opaque SQL — this
// repo has no Docker/pgTAP to test SQL directly, and this is exactly the kind of combination
// logic that's easy to get subtly wrong (see costSummary.test.ts). `CostSummaryRow.source` is
// `string`, not a closed union (see its doc comment in @vacationist/types) — an unrecognized
// source is safely converted below but simply doesn't contribute to any category until the
// CATEGORY logic in this file is updated for it.

export type CostCategory = 'base' | 'transfer' | 'activities' | 'expenses';

export interface CostSummaryResult {
  /** Sum of all four category totals, in `baseCurrency`. */
  total: number;
  byCategory: Record<CostCategory, number>;
  /** Number of RPC rows dropped because their currency (or `baseCurrency` itself) had no entry
   * in `rates` — surfaced so the UI can show "N amounts excluded — rate unavailable" instead of
   * silently presenting an incomplete total as if it were the whole picture. */
  excludedSourceCount: number;
}

const ENTITY_SOURCES_BY_CATEGORY: Record<'base' | 'transfer' | 'activities', string[]> = {
  base: ['accommodation'],
  transfer: ['transfer_flight', 'transfer_rental', 'transfer_public_transport'],
  activities: ['activity'],
};

/** The expense `related_type` bucket each entity-priced category defers to when it has no
 * priced/committed entity of its own yet (category-level precedence — see module doc on the
 * Tech Lead's "entity price wins" decision). `expense_manual`/`expense_shopping` have no entity
 * counterpart and are handled separately, always additive. */
const EXPENSE_FALLBACK_SOURCE: Record<'base' | 'transfer' | 'activities', string> = {
  base: 'expense_accommodation',
  transfer: 'expense_transport',
  activities: 'expense_activity',
};

/**
 * Converts every row into `baseCurrency`, applies category-level precedence (an entity-priced
 * category's own price sum wins over its matching expense bucket whenever that sum is `> 0`;
 * the expense bucket fills in only when nothing has been priced at the entity level yet), and
 * returns one converted total per category plus a grand total.
 *
 * Known, accepted edge case: an entity priced at exactly 0 (e.g. a free/comped accommodation)
 * is indistinguishable here from "nothing priced yet" — its category's expense fallback would
 * still apply on top of that 0. This mirrors the same simplification already accepted for
 * per-person cost splitting elsewhere in the app rather than requiring a real per-row link
 * (`expenses.related_id`, which the UI does not populate today) to disambiguate.
 */
export function computeTripCostSummary(
  rows: CostSummaryRow[],
  rates: CurrencyRateMap,
  baseCurrency: string,
): CostSummaryResult {
  const sumBySource = new Map<string, number>();
  let excludedSourceCount = 0;

  for (const row of rows) {
    let converted: number;
    if (row.currency === baseCurrency) {
      converted = row.amount;
    } else {
      const rateFrom = rates[row.currency];
      const rateTo = rates[baseCurrency];
      if (rateFrom == null || rateTo == null) {
        excludedSourceCount++;
        continue;
      }
      converted = convertAmount(row.amount, rateFrom, rateTo);
    }
    sumBySource.set(row.source, (sumBySource.get(row.source) ?? 0) + converted);
  }

  const byCategory: Record<CostCategory, number> = { base: 0, transfer: 0, activities: 0, expenses: 0 };
  let expensesTotal = (sumBySource.get('expense_manual') ?? 0) + (sumBySource.get('expense_shopping') ?? 0);

  for (const category of ['base', 'transfer', 'activities'] as const) {
    const entitySum = ENTITY_SOURCES_BY_CATEGORY[category].reduce((sum, source) => sum + (sumBySource.get(source) ?? 0), 0);
    byCategory[category] = entitySum;
    if (entitySum === 0) {
      expensesTotal += sumBySource.get(EXPENSE_FALLBACK_SOURCE[category]) ?? 0;
    }
  }
  byCategory.expenses = expensesTotal;

  const total = byCategory.base + byCategory.transfer + byCategory.activities + byCategory.expenses;

  return { total, byCategory, excludedSourceCount };
}

export interface BudgetProgress {
  /** total ÷ memberCount — the group total's per-person share, shown even without a budget set. */
  perPerson: number;
  /** false when `budgetPerPerson` is null — the caller should render no progress bar/percentage
   * at all in that case, not divide by it or show a 0%/NaN%/Infinity% bar. */
  hasBudget: boolean;
  /** Unclamped — a trip over budget correctly reads e.g. "134%" as text. */
  percent: number;
  /** Clamped to [0, 100] — feed this into a progress bar's fill width so an over-budget trip's
   * bar stops at full rather than overflowing its container or needing its own clamp logic. */
  clampedPercent: number;
}

/**
 * Trip Overview's "≈ X per person (of Y budget)" line + progress bar math. `budgetPerPerson` is
 * nullable (`trips.budget_per_person` has no default) — `memberCount` is always `>= 1` in
 * practice (the organizer is always a member), but this still guards a `0` defensively since
 * dividing a real currency total by zero must never reach the UI as `Infinity`.
 */
export function computeBudgetProgress(total: number, budgetPerPerson: number | null, memberCount: number): BudgetProgress {
  const perPerson = memberCount > 0 ? total / memberCount : total;
  if (budgetPerPerson == null) {
    return { perPerson, hasBudget: false, percent: 0, clampedPercent: 0 };
  }
  const budgetTotal = budgetPerPerson * memberCount;
  const percent = budgetTotal > 0 ? (total / budgetTotal) * 100 : 0;
  return { perPerson, hasBudget: true, percent, clampedPercent: Math.min(100, Math.max(0, percent)) };
}

export interface MyTripCostShare {
  tripId: string;
  tripTitle: string;
  startDate: string;
  year: number;
  /** In `displayCurrency`. */
  share: number;
}

export interface MyCostSharesResult {
  /** One entry per trip the caller belongs to, in the RPC's original row order (grouping/sorting
   * by year is a display concern — see Item 2's UI, not this function's job). */
  trips: MyTripCostShare[];
  totalByYear: Record<number, number>;
  /** Sum of every trip's share — independent of how the UI groups/collapses years, since it's
   * computed directly from `trips`, never derived from `totalByYear`. */
  total: number;
  excludedSourceCount: number;
}

/**
 * "My share" per trip (v1.34.0 item 2 — the global Analytics tab), NOT a uniform
 * `amount ÷ memberCount` — that formula is wrong for flights and public transport specifically:
 *
 * - `transfer_flight` / `transfer_public_transport`: the entry's price counts in full ONLY when
 *   `is_mine` is true — the caller is an assigned passenger on that specific entry OR has
 *   uploaded a ticket for it (v1.34.1 tasks 3/4) — 0 otherwise. A trip with two flights where
 *   the caller only took one must not be charged for the one they didn't fly.
 * - `expense_owed_by_me`: already the caller's exact debt share (from `expense_splits`) — passed
 *   through as-is, never re-derived, since this function has no business owning a second
 *   implementation of the settlement math `get_trip_balances` already owns.
 * - Everything else (`accommodation`, `transfer_rental`, `activity`) has no per-person
 *   assignment concept on its table, so an even split across `member_count` is the only
 *   available signal — summed in the row's own currency terms first, then divided once by
 *   `member_count`, rather than dividing every row individually, to avoid compounding rounding
 *   error across many small rows.
 */
export function computeMyCostShares(rows: MyCostShareRow[], rates: CurrencyRateMap, displayCurrency: string): MyCostSharesResult {
  const byTrip = new Map<string, MyCostShareRow[]>();
  for (const row of rows) {
    const existing = byTrip.get(row.trip_id);
    if (existing) existing.push(row);
    else byTrip.set(row.trip_id, [row]);
  }

  let excludedSourceCount = 0;
  const trips: MyTripCostShare[] = [];

  for (const [tripId, tripRows] of byTrip) {
    const { trip_title: tripTitle, start_date: startDate, member_count: memberCount } = tripRows[0];
    let gatedShare = 0;
    let expenseOwed = 0;
    let evenSplitSum = 0;

    for (const row of tripRows) {
      let converted: number;
      if (row.currency === displayCurrency) {
        converted = row.amount;
      } else {
        const rateFrom = rates[row.currency];
        const rateTo = rates[displayCurrency];
        if (rateFrom == null || rateTo == null) {
          excludedSourceCount++;
          continue;
        }
        converted = convertAmount(row.amount, rateFrom, rateTo);
      }

      if (row.source === 'transfer_flight' || row.source === 'transfer_public_transport') {
        // Passenger-or-ticket gated (one row per entry) — counts in full or not at all.
        if (row.is_mine) gatedShare += converted;
      } else if (row.source === 'expense_owed_by_me') {
        expenseOwed += converted;
      } else {
        evenSplitSum += converted;
      }
    }

    const share = gatedShare + expenseOwed + (memberCount > 0 ? evenSplitSum / memberCount : evenSplitSum);
    trips.push({ tripId, tripTitle, startDate, year: Number(startDate.slice(0, 4)), share });
  }

  const totalByYear: Record<number, number> = {};
  for (const t of trips) {
    totalByYear[t.year] = (totalByYear[t.year] ?? 0) + t.share;
  }
  const total = trips.reduce((sum, t) => sum + t.share, 0);

  return { trips, totalByYear, total, excludedSourceCount };
}
