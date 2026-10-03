import type { CostSummaryRow, MyCostShareRow } from '@vacationist/types';
import { convertAmount, type CurrencyRateMap } from './currencyConversion';
import { roundCurrency } from './format';

export type { CostSummaryRow, MyCostShareRow };

// The RPC (get_trip_cost_summary) is deliberately "dumb": mechanical status/soft-delete
// filtering and per-(source, currency) grouping only. Everything below (category-level
// precedence, currency conversion) is a pure, unit-tested function instead of opaque SQL — this
// repo has no Docker/pgTAP to test SQL directly, and this is exactly the kind of combination
// logic that's easy to get subtly wrong (see costSummary.test.ts). `CostSummaryRow.source` is
// `string`, not a closed union (see its doc comment in @vacationist/types) — an unrecognized
// source is safely converted below but simply doesn't contribute to any category until the
// CATEGORY logic in this file is updated for it.

export type CostCategory = 'base' | 'transfer' | 'expenses';

export interface CostSummaryResult {
  /** Sum of all three category totals, in `baseCurrency`. */
  total: number;
  byCategory: Record<CostCategory, number>;
  /** Number of RPC rows dropped because their currency (or `baseCurrency` itself) had no entry
   * in `rates` — surfaced so the UI can show "N amounts excluded — rate unavailable" instead of
   * silently presenting an incomplete total as if it were the whole picture. */
  excludedSourceCount: number;
}

const ENTITY_SOURCES_BY_CATEGORY: Record<'base' | 'transfer', string[]> = {
  base: ['accommodation'],
  transfer: ['transfer_flight', 'transfer_rental'],
};

/**
 * Converts every row into `baseCurrency` and returns one converted total per category plus a
 * grand total. `base`/`transfer` are simple sums of their entity sources (v1.39.2: the RPC
 * already excludes an entity row once a live expense is linked to it via `related_id`, see
 * `20261003110000_cost_summary_related_id_exclusion.sql`). Every `expense_*` source is additive
 * into `expenses` — matched generically (`startsWith('expense_')`) rather than by name, because
 * the RPC emits `'expense_' || related_type`: a hardcoded list would silently drop a new category
 * from the trip total until someone remembered to add it.
 *
 * `activity` (the entity source — `activities.cost_estimate`) is deliberately never summed into
 * any category: it's a rough per-item planning number, not a committed cost, and in practice
 * rarely matches what actually gets spent (a "Dinner" activity's real cost shows up later as an
 * `expense_activity` row instead, which — like every other `expense_*` source — still counts).
 * An `activity` row is simply an unrecognized source here, same as any source this function
 * doesn't know about: converted safely but contributing to no bucket.
 *
 * `transfer_public_transport` is excluded the same way, for a different reason (2026-10-03
 * follow-up): the "record this as an expense?" prompt that used to populate `related_id` for it
 * was removed (premature — ridership is often unknown/still changing when a PT entry's price is
 * set), which would otherwise leave PT as the one entity type that can silently double-count
 * forever with no mitigation available. A manually-recorded `expense_transport` row still counts,
 * exactly like `expense_activity` — only the PT entity's own price stops being summed.
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

  const byCategory: Record<CostCategory, number> = { base: 0, transfer: 0, expenses: 0 };
  let expensesTotal = 0;
  for (const [source, sum] of sumBySource) {
    if (source.startsWith('expense_')) expensesTotal += sum;
  }

  for (const category of ['base', 'transfer'] as const) {
    byCategory[category] = ENTITY_SOURCES_BY_CATEGORY[category].reduce((sum, source) => sum + (sumBySource.get(source) ?? 0), 0);
  }
  byCategory.expenses = expensesTotal;

  const total = byCategory.base + byCategory.transfer + byCategory.expenses;

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
   * by year is a display concern — see Item 2's UI, not this function's job). Each trip's
   * `share` is rounded to 2 decimals, so `totalByYear` and `total` (both sums of those rounded
   * shares) reconcile to the per-trip rows the UI renders. */
  trips: MyTripCostShare[];
  /** Per-year sum of the (already-rounded) trip shares, itself re-rounded — so the year header
   * the UI shows always equals the sum of that year's visible trip rows. */
  totalByYear: Record<number, number>;
  /** Sum of every trip's rounded share — computed directly from `trips`, never derived from
   * `totalByYear`, so a year-grouping bug can't corrupt it. */
  total: number;
  /** Number of `(trip, currency)` pairs whose amount could not be converted (no cached rate for
   * that currency or for `displayCurrency`) and was therefore dropped from the totals — surfaced
   * so the UI can warn "N amounts excluded — rate unavailable" instead of quietly showing a
   * partial figure. Deduped per trip: many unconvertible rows sharing one currency count once. */
  excludedSourceCount: number;
}

/**
 * "My share" per trip (v1.34.0 item 2 — the global Analytics tab), NOT a uniform
 * `amount ÷ memberCount`. Per source:
 *
 * - `transfer_flight`: the entry's price counts in full ONLY when `is_mine` is true — the caller
 *   is an assigned passenger on that specific entry OR has uploaded a ticket for it (v1.34.1
 *   tasks 3/4) — 0 otherwise. A trip with two flights where the caller only took one must not be
 *   charged for the one they didn't fly. A non-`is_mine` row is skipped before any FX lookup, so
 *   a flight the caller isn't on can't push a rate-unavailable currency into
 *   `excludedSourceCount` (it would never have counted anyway).
 * - `accommodation` / `transfer_rental`: no per-person assignment concept on the table, so an
 *   even split across `member_count` is the only available signal — converted per row, summed,
 *   then divided once by `member_count` (not per row, to avoid compounding rounding error across
 *   many small rows).
 * - `activity` / `transfer_public_transport`: never counted — see `computeTripCostSummary`'s doc
 *   comment for why each is excluded (`activity` is a rough planning estimate; PT lost its only
 *   `related_id`-linking mechanism when its booking-prompt was removed, 2026-10-03). Both are
 *   skipped before any FX lookup, so an unconvertible currency on either doesn't inflate
 *   `excludedSourceCount` for a number that wouldn't have counted anyway.
 * - `expense_owed_by_me`: the caller's own `expense_splits.amount_owed` sum, never re-derived
 *   (that's `get_trip_balances`' job). The RPC emits one such row per `related_type`, and every
 *   bucket (`accommodation`/`transport`/`activity`/`shopping`/`manual`) is always added — the RPC
 *   itself excludes an accommodation/transport entity row once a live expense is linked to it via
 *   `expenses.related_id` (see `20261003110000_cost_summary_related_id_exclusion.sql`), and
 *   `activity` never had an entity-sum to guard against in the first place now that its entity
 *   row is never counted.
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

  /** Convert a row into `displayCurrency`, or `null` when a needed rate is missing. */
  const convert = (row: MyCostShareRow): number | null => {
    if (row.currency === displayCurrency) return row.amount;
    const rateFrom = rates[row.currency];
    const rateTo = rates[displayCurrency];
    if (rateFrom == null || rateTo == null) return null;
    return convertAmount(row.amount, rateFrom, rateTo);
  };

  for (const [tripId, tripRows] of byTrip) {
    const { trip_title: tripTitle, start_date: startDate, member_count: memberCount } = tripRows[0];

    let gatedShare = 0; // my flights: full price when is_mine, 0 otherwise
    let evenSplitSum = 0; // accommodation + rental entity prices, pre-division
    const expenseOwed = { accommodation: 0, transport: 0, activity: 0, shopping: 0, manual: 0 };
    // Deduped so one unconvertible currency in a trip counts once, not once per row — the RPC
    // now emits an expense row per related_type, which would otherwise multiply the count ~5x.
    const excludedCurrencies = new Set<string>();

    for (const row of tripRows) {
      if (row.source === 'activity' || row.source === 'transfer_public_transport') continue; // never part of the analysis

      if (row.source === 'transfer_flight') {
        if (!row.is_mine) continue; // costs me nothing — skip before any FX lookup
        const converted = convert(row);
        if (converted == null) { excludedCurrencies.add(row.currency); continue; }
        gatedShare += converted;
        continue;
      }

      const converted = convert(row);
      if (converted == null) { excludedCurrencies.add(row.currency); continue; }

      if (row.source === 'accommodation' || row.source === 'transfer_rental') {
        evenSplitSum += converted;
      } else if (row.source === 'expense_owed_by_me') {
        switch (row.related_type) {
          case 'accommodation': expenseOwed.accommodation += converted; break;
          case 'transport': expenseOwed.transport += converted; break;
          case 'activity': expenseOwed.activity += converted; break;
          case 'shopping': expenseOwed.shopping += converted; break;
          default: expenseOwed.manual += converted; break; // 'manual', or null / an unknown future type
        }
      }
      // an unrecognized source is converted safely but contributes to no bucket
    }

    excludedSourceCount += excludedCurrencies.size;

    const evenSplitShare = memberCount > 0 ? evenSplitSum / memberCount : evenSplitSum;
    const share = roundCurrency(
      gatedShare +
        evenSplitShare +
        expenseOwed.manual +
        expenseOwed.shopping +
        expenseOwed.accommodation +
        expenseOwed.transport +
        expenseOwed.activity,
    );
    trips.push({ tripId, tripTitle, startDate, year: Number(startDate.slice(0, 4)), share });
  }

  const totalByYear: Record<number, number> = {};
  for (const t of trips) {
    totalByYear[t.year] = roundCurrency((totalByYear[t.year] ?? 0) + t.share);
  }
  const total = roundCurrency(trips.reduce((sum, t) => sum + t.share, 0));

  return { trips, totalByYear, total, excludedSourceCount };
}
